module.exports = {
    metadata: {
        family: "camera",
        plugin: "usbCamera",
        label: "USB Camera",
        tangible: true,
        actorTypes: [],
        sensorTypes: [],
        services: [],
        configuration: [{
            id: "inputDevice",
            label: "Input Device",
            type: {id: "string"},
            default: "0"
        }, {
            id: "inputFormat",
            label: "Input Format",
            type: {id: "string"},
            default: "avfoundation"
        }, {id: "bufferFiles", label: "Buffer Files", type: {id: "integer"}, default: "2"},
            {id: "videoWidth", label: "Video Width", type: {id: "integer"}, default: "320"}, {
                id: "videoHeight",
                label: "Video Height",
                type: {id: "integer"},
                default: "180"
            }, {
                id: "latency",
                label: "Latency",
                type: {id: "integer"},
                default: "5"
            }]
    },
    create: function (device) {
        return new UsbCamera();
    }
};

var q = require('q');
var ffmpeg;

/**
 *
 */
function UsbCamera() {
    /**
     *
     */
    UsbCamera.prototype.start = function () {
        var deferred = q.defer();

        this.state = {};

        // Open namespace for web socket connections

        //var namespaceName = this.node.namespacePrefix + "/devices/" + this.id + "/streams/video";
        //
        //console.log("Namespace: " + namespaceName);
        //
        //this.namespace = this.node.io.of(namespaceName);
        //
        //this.namespace.on("connection",
        //    function (socket) {
        //        console.log("Stream socket connection established for "
        //        + this.id);
        //
        //        this.maxFiles = this.configuration.bufferFiles;
        //        this.videoSize = "" + this.configuration.videoWidth + "x" + this.configuration.videoHeight;
        //        this.fileIndex = 0;
        //        this.state = {video: "0"};
        //
        //        this.pushCameraInput();
        //    }.bind(this));
        //this.namespace.on("disconnect", function (socket) {
        //    console.log("Stream socket disconnected established for "
        //    + this.id);
        //}.bind(this));
        // this.socketStream = socketStream.create(this.namespace);

        if (this.isSimulated()) {
            deferred.resolve();

            setInterval(function () {
                this.state = {video: "" + new Date().getMilliseconds()};

                this.publishStateChange();
            }.bind(this), this.configuration.latency * 1000);
        } else {
            if (!ffmpeg) {
                ffmpeg = require("fluent-ffmpeg");
            }

            this.maxFiles = this.configuration.bufferFiles;
            this.videoSize = "" + this.configuration.videoWidth + "x" + this.configuration.videoHeight;
            this.fileIndex = 0;
            this.state = {video: "0"};

            this.streamChunk();

            deferred.resolve();
        }

        return deferred.promise;
    };

    /**
     *
     */
    UsbCamera.prototype.pushCameraInput = function () {
        var streamHeader = new Buffer(8);

        streamHeader.write("jsmp");
        streamHeader.writeUInt16BE(this.configuration.videoWidth, 4);
        streamHeader.writeUInt16BE(this.configuration.videoHeight, 6);

        this.socketStream.write(streamHeader);

        ffmpeg().input(this.configuration.inputDevice).inputFormat(this.configuration.inputFormat)
            .outputFormat("mpeg1video").size(this.videoSize)
            .on('end', function () {
            }.bind(this))
            .on('error', function (error) {
                console.error(error.message);
            }).pipe(this.socketStream, {end: true});
    };

    /**
     *
     */
    UsbCamera.prototype.streamChunk = function () {
        ffmpeg().input(this.configuration.inputDevice).inputFormat(this.configuration.inputFormat)
            .duration(this.configuration.latency).size(this.videoSize)
            .on('end', function () {
                this.state = {video: "" + this.fileIndex};

                this.publishStateChange();

                this.fileIndex = (this.fileIndex + 1) % this.maxFiles;

                this.streamChunk();
            }.bind(this))
            .on('error', function (error) {
                console.error(error.message);
            }).save(this.getStreamingFilePath(this.fileIndex));
    };

    /**
     *
     */
    UsbCamera.prototype.getStreamingFilePath = function (stream) {
        if (this.isSimulated()) {
            return __dirname + "/data/spaceship.m4v";
        } else {
            return __dirname + "/../../../" + this.node.options.dataDirectory + "/" + this.id + "-" + stream + ".m4v";
        }
    };

    /**
     *
     */
    UsbCamera.prototype.pipeStream = function (req, res, stream) {
        this.pipeFile(req, res, this.getStreamingFilePath(stream), "video/mp4");
    };

    /**
     *
     */
    UsbCamera.prototype.setState = function (state) {
        this.state = state;
    };

    /**
     *
     */
    UsbCamera.prototype.getState = function () {
        return this.state;
    };
}
