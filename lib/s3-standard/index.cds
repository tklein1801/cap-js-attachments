@protocol: 'none'
service AWSAttachmentsService {

    action onSTREAM(fileName : String) returns {
        inputStream : LargeBinary
    };

    action onGET() returns {
        objectList: String;
    }

}
