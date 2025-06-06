
using { sap.capire.incidents as my } from './schema';
using { sap.attachments.Attachments } from '@tklein1801/cap-js-attachments';

extend my.Incidents with {
  attachments: Composition of many Attachments;
  @attachments.disable_facet
  hiddenAttachments: Composition of many Attachments;
}