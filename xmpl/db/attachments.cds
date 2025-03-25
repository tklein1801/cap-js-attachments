
using { sap.capire.incidents as my } from '@capire/incidents/db/schema';
using { Attachments } from '@tklein1801/cap-js-attachments';

extend my.Incidents with {
  attachments: Composition of many Attachments;
}
