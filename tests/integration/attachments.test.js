const cds = require("@sap/cds");
const incidentsApp = require("path").resolve(__dirname, "./../../xmpl");
const { expect, axios, GET, POST, DELETE } = cds.test(incidentsApp);
const { RequestSend } = require("../utils/api");
const { createReadStream } = cds.utils.fs;
const { join } = cds.utils.path;

axios.defaults.auth = { username: "alice" };
jest.setTimeout(5 * 60 * 1000);

describe("Tests for Attachments - mock data (xmpl) in in-memory database", () => {
  let attachmentsSrv = null;
  let utils = null;
  let sampleDocID = null;
  const incidentID = "3b23bb4b-4ac7-4a24-ac02-aa10cabd842c";
  beforeAll(async () => {
    attachmentsSrv = await cds.connect.to("attachments");
    utils = new RequestSend(POST);
  });

  //Reading the attachment list and checking for content
  it("Reading attachments list", async () => {
    //read attachments list for Incident - Inverter not functional
    try {
      const response = await GET(
        `odata/v4/processor/Incidents(ID=${incidentID},IsActiveEntity=true)/attachments`
      );
      //the mock data has two attachments in this incident
      expect(response.status).to.equal(200);
      expect(response.data.value.length).to.equal(2);
      sampleDocID = response.data.value[0].ID;
      //to make sure content is not read
      expect(response.data.value[0].content).to.be.undefined;
    } catch (err) {
      expect(err).to.be.undefined;
    }
  });

  //Reading the uploaded attachment content and that it exists
  it("Reading the uploaded attachment document", async () => {
    //checking the uploaded attachment document

    try {
      const response = await GET(
        `odata/v4/processor/Incidents(ID=${incidentID},IsActiveEntity=true)/attachments(up__ID=${incidentID},ID=${sampleDocID},IsActiveEntity=true)/content`
      );
      expect(response.status).to.equal(200);
      expect(response.data).to.not.be.undefined;
    } catch (err) {
      expect(err).to.be.undefined;
    }
  });
});

describe("Tests for Attachments - calls on sample application in in-memory db", () => {
  let attachmentsSrv = null;
  let utils = null;
  let sampleDocID = null;
  const incidentID = "3ccf474c-3881-44b7-99fb-59a2a4668418";
  beforeAll(async () => {
    attachmentsSrv = await cds.connect.to("attachments");
    utils = new RequestSend(POST);
  });

  //Draft mode uploading attachment
  it("Uploading image in draft mode", async () => {
    //function to upload image
    let action = await POST.bind(
      {},
      `odata/v4/processor/Incidents(ID=${incidentID},IsActiveEntity=false)/attachments`,
      {
        up__ID: incidentID,
        filename: "sample.pdf",
        mimeType: "application/pdf",
        content: createReadStream(join(__dirname, "content/sample.pdf")),
        createdAt: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ),
        createdBy: "alice",
      }
    );

    try {
      //trigger to upload attachment
      await utils.apiAction(
        "processor",
        "Incidents",
        incidentID,
        "ProcessorService",
        action
      );
    } catch (err) {
      expect(err).to.be.undefined;
    }

    //read attachments list for Incident
    try {
      const response = await GET(
        `odata/v4/processor/Incidents(ID=${incidentID},IsActiveEntity=true)/attachments`
      );
      //the data should have two attachments
      expect(response.status).to.equal(200);
      expect(response.data.value.length).to.equal(2);
      //to make sure content is not read
      expect(response.data.value[0].content).to.be.undefined;
      sampleDocID =
        response.data.value[0].filename == "sample.pdf"
          ? response.data.value[0].ID
          : response.data.value[1].ID;
    } catch (err) {
      expect(err).to.be.undefined;
    }

    //read attachment in active table
    try {
      const response = await GET(
        `odata/v4/processor/Incidents(ID=${incidentID},IsActiveEntity=true)/attachments(up__ID=${incidentID},ID=${sampleDocID},IsActiveEntity=true)/content`
      );
      expect(response.status).to.equal(200);
      expect(response.data).to.not.be.undefined;
    } catch (err) {
      expect(err).to.be.undefined;
    }
  });

  //Deleting the attachment
  it("Deleting the attachment", async () => {
    //check the content of the uploaded attachment in main table
    try {
      const response = await GET(
        `odata/v4/processor/Incidents(ID=${incidentID},IsActiveEntity=true)/attachments(up__ID=${incidentID},ID=${sampleDocID},IsActiveEntity=true)/content`
      );
      expect(response.status).to.equal(200);
    } catch (err) {
      expect(err).to.be.undefined;
    }

    //delete attachment
    let action = await DELETE.bind(
      {},
      `odata/v4/processor/Incidents_attachments(up__ID=${incidentID},ID=${sampleDocID},IsActiveEntity=false)`
    );
    try {
      //trigger to upload attachment
      await utils.apiAction(
        "processor",
        "Incidents",
        incidentID,
        "ProcessorService",
        action
      );
    } catch (err) {
      expect(err).to.be.undefined;
    }

    //content should not be there
    try {
      const response = await GET(
        `odata/v4/processor/Incidents(ID=${incidentID},IsActiveEntity=true)/attachments(up__ID=${incidentID},ID=${sampleDocID},IsActiveEntity=true)/content`
      );
    } catch (err) {
      expect(err.code).to.equal("ERR_BAD_REQUEST");
    }
  });
});
