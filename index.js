"use strict";

const moment = require('moment');
const Promise = require('bluebird');
const AWS = require('aws-sdk');
const crypto = require('crypto');

/** Class representing S3 functions.   Standard environment variables need to be present.
 * 
 * 
 * @class S3
 */

class S3 {
    /**
     * Creates an instance of S3. 
     * 
     * @param {object} config - Optional object containing 
     * @
     * 
     * @memberOf S3
     */
    constructor(config) {
        this.AWS_BUCKET = config.AWS_BUCKET || process.env.AWS_BUCKET || null;
    }

        /** 
         *  Get expiration time for S3 policy
         * 
         * @returns {string} returns expiration time for S3 policy
         * 
         * @memberOf S3
         */
        getExpiryTime() {
        let _date = new Date();
        return '' + (_date.getFullYear()) + '-' + (_date.getMonth() + 1) + '-' +
            (_date.getDate() + 1) + 'T' + (_date.getHours() + 3) + ':' + '00:00.000Z';
    }

        /**
         *  Generates a policy for browser uploads
         * 
         * @param {string} contentType - Mime type for file to be uploaded.
         * @param {string} acl - acl type for file to be uploaded.   either 'public-read' or 'private' @default is 'private'
         * @param {string} bucket - Optional.   Will use bucket if provided, or will use bucket passed into constructor if passed. - Optional.   Will use bucket if provided, or will use bucket passed into constructor if passed.
         * @returns {Promise} Base64 encoded representation of policy
         * 
         * @memberOf S3
         */
        createS3Policy(contentType, acl, bucket) {
        return new Promise(function(resolve, reject) {
            let _contentType = contentType || "";
            let _bucket = bucket || this.AWS_BUCKET;
            let _acl = acl || 'private';
            let date = new Date();
            var s3Policy = {
                'expiration': module.exports.aws.getExpiryTime(),
                'conditions': [ //https://aws.amazon.com/articles/1434/
                    ['starts-with', '$key', ''], {
                        'bucket': _bucket
                    }, {
                        'acl': _acl
                    }, {
                        'success_action_status': '201'
                    },
                    ["starts-with", "$Content-Type", _contentType],
                    ["starts-with", "$filename", ""],
                    ["content-length-range", 0, 1048576 * 10]

                ]
            };

            // stringify and encode the policy
            let stringPolicy = JSON.stringify(s3Policy);
            let base64Policy = new Buffer(stringPolicy, 'utf-8').toString('base64');

            // sign the base64 encoded policy
            let signature = crypto.createHmac('sha1', process.env.AWS_SECRET_ACCESS_KEY)
                .update(new Buffer(base64Policy, 'utf-8')).digest('base64');

            // build the results object
            let s3Credentials = {
                s3Policy: base64Policy,
                s3Signature: signature,
                AWSAccessKeyId: process.env.AWS_ACCESS_KEY_ID
            };

            // send it back
            resolve(s3Credentials);

        });
    }
    /**
     * 
     * 
     * @param {string} key
     * @param {string} bucket - Optional.   Will use bucket if provided, or will use bucket passed into constructor if passed. - Optional.   Will use bucket if provided, or will use bucket passed into constructor if passed.
     * @returns {Promise}
     * 
     * @memberOf S3
     */
        deleteS3Object(key, bucket) {
        return new Promise(function(resolve, reject) {
            let _bucket = bucket || this.AWS_BUCKET;
            if (!key) {
                reject('Error, no key');
            }
            let s3 = new AWS.S3();
            s3.deleteObjects({
                Bucket: _bucket,
                Delete: {
                    Objects: [{
                        Key: key
                    }]
                }
            }, function(err, data) {
                if (err) {
                    console.log(err);
                    reject(err);
                }
                resolve(data);
            });
        });

    }
    /**
     * 
     * 
     * @param {buffer} body - Buffer of the file to be uploaded.
     * @param {string} key - key of the uploaded 
     * @param {string} bucket - Optional.   Will use bucket if provided, or will use bucket passed into constructor if passed.
     * @param {string} acl - Optional.   ACL to use.   Defaults to private.
     * @returns {Promise}
     * 
     * @memberOf S3
     */
        upload(body, key, bucket, acl) {
        return new Promise(function(resolve, reject) {
            let _bucket = bucket || this.AWS_BUCKET;
            let _acl = acl || 'private';
            let s3obj = new AWS.S3({
                params: {
                    Bucket: _bucket,
                    Key: key,
                    ACL: _acl
                }
            });
            s3obj.upload({ // upload the deliverable to S3
                    Body: body
                })
                .send(function(err, data) {
                    if (err) {
                        reject(err);
                    }
                    resolve(data);
                });

        });

    }
    /**
     * 
     * 
     * @param {string} key - file key.  ex: 'deliverables/myfile.docx'
     * @param {number} expiration - How long the signed url should last in minutes.  leave null for 20 minutes.
     * @param {string} bucket - Optional.   Will use bucket if provided, or will use bucket passed into constructor if passed.
     * @returns {Promise} - Signed URL
     * 
     * @memberOf S3
     */
    getSignedUrl(key, expiration, bucket) {
        return new Promise(function(resolve, reject) {
            let _bucket = bucket || this.AWS_BUCKET;
            let _defaultExp = 60 * 20 // 20 minutes.
            let _exp = expiration ? expiration * 60 : _defaultExp;
            let s3 = new AWS.S3();
            let url = s3.getSignedUrl('getObject', { // get a signed URL that will last for 20 minutes.
                Bucket: _bucket,
                Key: key,
                Expires: _exp
            });
            resolve(url);
        });
    }
    /**
     * 
     * 
     * @param {string} key ex: 'processed/kitty.png'
     * @param {string} bucket - Optional.   Will use bucket if provided, or will use bucket passed into constructor if passed.
     * @returns {Promise} - Resolved to promise wih with buffer representation of download.   Buffer can be used as a stream or written to a file.
     * 
     * @memberOf S3
     */
    download(key, bucket) {
        return new Promise(function(resolve, reject) {
            let _bucket = bucket || this.AWS_BUCKET;
            let s3 = new AWS.S3();
            let params = {
                Bucket: _bucket,
                Key: key
            };
            var data;
            s3.getObject(params, (err, data) => {
                    resolve(data);
                });
        });
    }

}

module.exports = S3;

