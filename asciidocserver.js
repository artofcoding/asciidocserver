/*
 * Copyright 2016 art of coding UG, https://www.art-of-coding.eu
 */

/* jshint esversion: 6 */

var argv = require('minimist')(process.argv.slice(2));

const blogContentDirectory = argv.blogroot || 'asciidoc/blog';
const bookContentDirectory = argv.bookroot || 'asciidoc/book';
const regex = /\/([\w-]+)\/([\w-]+){1}(\.\w+){0,}/;

const path = require('path');
const fs = require('fs');

const asciidoctor = require('asciidoctor.js')();
const processor = asciidoctor.Asciidoctor(true);
const pandoc = require('node-pandoc');

function decodeUrl(req, regex) {
    var pathMatch = req._parsedUrl.path.substring(0, 255).match(regex);
    return {
        type: pathMatch[1],
        name: pathMatch[2],
        ext: undefined === pathMatch[3] ? 'html' : pathMatch[3].substring(1)
    };
}

function renderWithAsciidoctor(documentType, backend, baseDir, name, filePath, callback) {
    var content = fs.readFileSync(filePath, {
        encoding: 'utf8'
    });
    // See http://asciidoctor.org/docs/user-manual/#running-asciidoctor-securely
    var options = asciidoctor.Opal.hash2(
        ['doctype', 'header_footer', 'safe', 'attributes'], {
            doctype: documentType,
            header_footer: true,
            safe: 'server',
            attributes: [
                'backend=' + backend,
                'icons=font',
                'showtitle',
                'docinfo1',
                //'base_dir=' + path.resolve(baseDir)
                'docdir=' + path.resolve(baseDir)
            ]
        }
    );
    callback(processor.$convert(content, options));
}

function renderWithPandoc(documentType, backend, baseDir, name, filePath, callback) {
    renderWithAsciidoctor(documentType, 'docbook', baseDir, name, filePath, (content) => {
        const dest = './' + name + '.' + backend;
        const args = '-r docbook -t ' + backend + ' -o ' + dest;
        pandoc(content, args, (err, result) => {
            if (err) {
                console.error('Oh Nos: ', err);
            } else {
                const r = fs.readFileSync(dest);
                // TODO remove file
                callback(r);
            }
        });
    });
}

function renderPdfWithPandoc(documentType, backend, baseDir, name, filePath, callback) {
    renderWithAsciidoctor(documentType, 'docbook', baseDir, name, filePath, (content) => {
        const dest = './' + name + '.pdf';
        const args = '-r docbook -t ' + backend + ' -o ' + dest;
        pandoc(content, args, (err, result) => {
            if (err) {
                console.error('Oh Nos: ', err);
            } else {
                const r = fs.readFileSync(dest);
                // TODO remove file
                callback(r);
            }
        });
    });
}

function renderContent(res, u) {
    switch (u.ext) {
        case 'html':
            renderWithAsciidoctor(u.type, 'html5', u.baseDir, u.name, u.filePath, (content) => {
                res.status(200).type('html').send(content);
            });
            break;
        case 'odt':
            renderWithPandoc(u.type, 'odt', u.baseDir, u.name, u.filePath, (content) => {
                res.status(200).type('application/odt').send(content);
            });
            break;
        case 'docx':
            renderWithPandoc(u.type, 'docx', u.baseDir, u.name, u.filePath, (content) => {
                res.status(200).type('application/docx').send(content);
            });
            break;
        case 'pdf':
            renderPdfWithPandoc(u.type, 'beamer', u.baseDir, u.name, u.filePath, (content) => {
                res.status(200).type('application/pdf').send(content);
            });
            break;
    }
}

function blogConfig(u) {
    const b = path.resolve(blogContentDirectory);
    return {
        baseDir: b,
        filePath: b + '/article/' + u.name + '.adoc'
    };
}

function bookConfig(u) {
    const b = path.resolve(bookContentDirectory + '/' + u.name);
    return {
        baseDir: b,
        filePath: b + '/' + u.name + '.adoc'
    };
}

const express = require('express');
const app = express();

app.use(express.static('public'));

app.get(/favicon\.ico/, function(req, res) {
    res.status(404);
});

app.get(regex, function(req, res) {
    const u = decodeUrl(req, regex);
    if (u.name == 'index') {
    } else {
        switch (u.type) {
            case 'blog':
                Object.assign(u, blogConfig(u));
                break;
            case 'book':
                Object.assign(u, bookConfig(u));
                break;
        }
    }
    var canRenderContent = undefined !== u.baseDir && undefined !== u.filePath;
    if (canRenderContent) {
        renderContent(res, u);
    } else {
        res.status(404).type('text').send('Not found');
    }
});

app.listen(3000, function() {
    console.log('Listening on port 3000!');
});
