
// The common root-level aspect used in applications like that:
// using { Attachments } from '@tklein1801/cap-js-attachments'
aspect Attachments : sap.attachments.Attachments {}


using { managed, cuid } from '@sap/cds/common';
context sap.attachments {

  aspect MediaData @(_is_media_data) {
    url      : String;
    content  : LargeBinary @title: 'Attachment'; // only for db-based services
    mimeType : String default 'application/octet-stream' @title: 'Media Type';
    filename : String @title: 'Filename';
    status   : String @title: 'Scan Status' enum {
      Unscanned;
      Scanning;
      Infected;
      Clean;
      Failed;
    } default 'Unscanned';
  }

  aspect Attachments : cuid, managed, MediaData {
    note : String @title: 'Note';
  }


  // -- Fiori Annotations ----------------------------------------------------------

  annotate MediaData with @UI.MediaResource: { Stream: content } {
    content  @Core.MediaType: mimeType @odata.draft.skip;
    mimeType @Core.IsMediaType;
    status @readonly;
  }

  annotate Attachments with @UI:{
    HeaderInfo: {
      TypeName: '{i18n>Attachment}',
      TypeNamePlural: '{i18n>Attachments}',
    },
    LineItem: [
      {Value: content, @HTML5.CssDefaults: {width: '30%'}},
      {Value: status, @HTML5.CssDefaults: {width: '10%'}},
      {Value: createdAt, @HTML5.CssDefaults: {width: '20%'}},
      {Value: createdBy, @HTML5.CssDefaults: {width: '15%'}},
      {Value: note, @HTML5.CssDefaults: {width: '25%'}}
    ]
  } {
    content
      @Core.ContentDisposition: { Filename: filename, Type: 'inline' }
  }

}
