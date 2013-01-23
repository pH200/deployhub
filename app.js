"use strict";

var http = require('http');
var path = require('path');
var fs = require("fs");
var exec = require('child_process').exec;

var express = require('express');
var waterfall = require("./lib/waterfall").waterfall;

var argv = require("optimist")
    .alias("d", "reposdir")
    .string(["reposdir"])
    ["default"]("persistence", "json")
    ["default"]("reposdir", process.env.FHUB_DIR || __dirname)
    ["default"]("port", process.env.PORT || 5567)
    .wrap(80)
    .argv;

var app = express();
var appdir = argv.reposdir;

app.configure(function () {
    app.set('port', argv.port);
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
});

app.configure('development', function () {
    app.use(express.errorHandler());
});

function payloadJsonParser (req, res, next) {
    var jobject;
    try {
        jobject = JSON.parse(req.body.payload);
    } catch(e) {
        return res.send(500, "invalid json");
    }
    req.payload = jobject;
    return next();
}

function gitFetch (reponame, callback) {
    var repodir = path.join(appdir, reponame + ".git");
    var commands = [
        "cd " +
            repodir +
            " && git fetch"
    ];
    return waterfall(commands.map(function (command) {
        return function (value, async) {
            return exec(command, async);
        };
    }), callback);
}

function gitFinalizer (req, res) {
    var reponame = req.reponame;
    var latestcommit = req.latestcommit;
    gitFetch(reponame, function (err, lastStdout) {
        if (err) {
            console.log(err);
            return res.send(500, "cannot use local git repository: " + reponame + ".git");
        }
        if (latestcommit) {
            console.log(reponame + " received commit " + latestcommit.substr(0, 6));
        } else {
            console.log(reponame + " received commit");
        }
        return res.send(200);
    });
}

// https://help.github.com/articles/post-receive-hooks
app.post("/github", payloadJsonParser, function (req, res, next) {
    var payload = req.payload;
    req.reponame = payload.repository.name;
    req.latestcommit = payload.after;
    return next();
}, gitFinalizer);

// https://confluence.atlassian.com/display/BITBUCKET/POST+Service+Management
app.post("/bitbucket", payloadJsonParser, function (req, res, next) {
    var payload = req.payload;
    req.reponame = payload.repository.slug;
    // TODO: extract latest commit string
    return next();
}, gitFinalizer);

http.createServer(app).listen(app.get('port'), function () {
    console.log("Fetch endpoint listening on port " + app.get('port'));
});
