const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { scanRequest } = require('./malwareScanner');
const cds = require('@sap/cds');
const logger = cds.log('attachments');
const { SELECT } = cds.ql;

module.exports = class AWSAttachmentsService extends require('./basic') {
  init() {
    const creds = {
      bucket: process.env.ATTACHMENTS_AWS_BUCKET || this.options.credentials?.bucket,
      region: process.env.ATTACHMENTS_AWS_REGION || this.options.credentials?.region,
      access_key_id:
        process.env.ATTACHMENTS_AWS_ACCESS_KEY_ID || this.options.credentials?.access_key_id,
      secret_access_key:
        process.env.ATTACHMENTS_AWS_SECRET_ACCESS_KEY ||
        this.options.credentials?.secret_access_key,
    };

    if (!creds.bucket || !creds.region || !creds.access_key_id || !creds.secret_access_key) {
      throw new Error('SAP Object Store instance is not bound or missing environment variables.');
    }

    this.bucket = creds.bucket;
    this.client = new S3Client({
      region: creds.region,
      credentials: {
        accessKeyId: creds.access_key_id,
        secretAccessKey: creds.secret_access_key,
      },
    });
    return super.init();
  }

  async put(attachments, data, _content) {
    if (Array.isArray(data)) return Promise.all(data.map((d) => this.put(attachments, d)));
    const { content = _content, ...metadata } = data;
    const Key = metadata.url;
    const input = {
      Bucket: this.bucket,
      Key,
      Body: content,
    };
    try {
      const multipartUpload = new Upload({
        client: this.client,
        params: input,
      });

      const stored = super.put(attachments, metadata);
      await Promise.all([stored, multipartUpload.done()]);
      if (this.kind === 's3') scanRequest(attachments, { ID: metadata.ID });
    } catch (err) {
      logger.error(err);
    }
  }

  // eslint-disable-next-line no-unused-vars
  async get(attachments, keys, req = {}) {
    const response = await SELECT.from(attachments, keys).columns('url');
    if (response?.url) {
      const Key = response.url;
      const content = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key,
        })
      );
      return content.Body;
    }
  }

  async deleteAttachment(key) {
    if (!key) return;
    return await this.delete(key);
  }

  async deleteAttachmentsWithKeys(records, req) {
    if (req?.attachmentsToDelete?.length > 0) {
      req.attachmentsToDelete.forEach((attachment) => {
        this.deleteAttachment(attachment.url);
      });
    }
  }

  async attachDeletionData(req) {
    const attachments = cds.model.definitions[req.query.target.name + '.attachments'];
    if (attachments) {
      const diffData = await req.diff();
      let deletedAttachments = [];
      diffData.attachments
        ?.filter((object) => {
          return object._op === 'delete';
        })
        .map((attachment) => {
          deletedAttachments.push(attachment.ID);
        });

      if (deletedAttachments.length > 0) {
        let attachmentsToDelete = await SELECT.from(attachments)
          .columns('url')
          .where({ ID: { in: [...deletedAttachments] } });
        if (attachmentsToDelete.length > 0) {
          req.attachmentsToDelete = attachmentsToDelete;
        }
      }
    }
  }

  async updateContentHandler(req, next) {
    if (req?.data?.content) {
      const response = await SELECT.from(req.target, { ID: req.data.ID }).columns('url');
      if (response?.url) {
        const Key = response.url;
        const input = {
          Bucket: this.bucket,
          Key,
          Body: req.data.content,
        };
        const multipartUpload = new Upload({
          client: this.client,
          params: input,
        });
        // TODO: add malware scan
        // const stored = super.put (Attachments, metadata)
        await Promise.all([multipartUpload.done()]);

        const keys = { ID: req.data.ID };
        scanRequest(req.target, keys);
      }
    } else if (req?.data?.note) {
      const key = { ID: req.data.ID };
      await super.update(req.target, key, { note: req.data.note });
    } else {
      next();
    }
  }

  registerUpdateHandlers(srv, entity, mediaElement) {
    srv.before(['DELETE', 'UPDATE'], entity, this.attachDeletionData.bind(this));
    srv.after(['DELETE', 'UPDATE'], entity, this.deleteAttachmentsWithKeys.bind(this));
    srv.prepend(() => {
      if (mediaElement.drafts) {
        srv.on('PUT', mediaElement.drafts, this.updateContentHandler.bind(this));
      }
    });
  }

  async delete(Key) {
    const response = await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key,
      })
    );
    return response.DeleteMarker;
  }

  async deleteInfectedAttachment(Attachments, key) {
    const response = await SELECT.from(Attachments, key).columns('url');
    return await this.delete(response.url);
  }
};
