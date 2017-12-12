/*
 * @Author: JieJiSS 
 * @Date: 2017-08-15 22:49:36 
 * @Last Modified by: JieJiSS
 * @Last Modified time: 2017-09-02 10:15:53
 */

"use strict";

const sha256 = require("sha256");
const path = require("path");
const promise = require("bluebird");

const cp = require("child_process");
const fs = require("fs");
const util = require("util");
const log = util.log.bind(util);
const clog = require("colorprint");

const keypress = require("keypress");

const readFile = promise.promisify(fs.readFile);

const start_timestamp = new Date().getTime();

let timeStamp = {
    toString() { 
        const d = new Date();
        return `${ d.getDate() } ${ getMonthString(d.getMonth()) } ${ d.toLocaleTimeString() }`;
    },
    toLocaleString() { 
        const d = new Date();
        return `${ d.getDate() } ${ getMonthString(d.getMonth()) } ${ d.toLocaleTimeString() }`;
    },
    valueOf() {
        const d = new Date();
        return `${ d.getDate() } ${ getMonthString(d.getMonth()) } ${ d.toLocaleTimeString() }`;
    }
};

// Colorful logs
const yellow = function () {
    let arg = Array.from(arguments);
    arg.unshift(timeStamp.toString() + " -");
    return clog.warn.apply(clog, arg);
};
const green = function () {
    let arg = Array.from(arguments);
    arg.unshift(timeStamp.toString() + " -");
    return clog.info.apply(clog, arg);
};
const red = function () {
    let arg = Array.from(arguments);
    arg.unshift(timeStamp.toString() + " -");
    return clog.error.apply(clog, arg);
};
const fatal = function () {
    let arg = Array.from(arguments);
    arg.unshift(timeStamp.toString() + " -");
    return clog.fatal.apply(clog, arg);
};
const magenta = function () {
    let arg = Array.from(arguments);
    arg.unshift(timeStamp.toString() + " -");
    return clog.notice.apply(clog, arg);
};

const sep = path.sep;

console.log = console.log.bind(console);

let filePath;
let outPath;

if(process.argv.includes("-h") || process.argv.includes("--help")) {
    showHelpMsg();
    process.exit(0);
}

if(process.argv.length < 3) { //无[$Tex_File]参数传入
    initTex();
}

filePath = filePath || process.argv[2];

let savedFilename = null;

if(!filePath.toLowerCase().endsWith(".tex")) {
    savedFilename = filePath;
    let dir = savedFilename + "_" + getTimeString();
    fs.mkdirSync(path.join(__dirname, "..\\..\\..\\LaTeX", dir));
    filePath = path.join(__dirname, "..\\..\\..\\LaTeX", dir, filePath);
    red(`400 Bad Request - Expecting LaTeX file ends with \".tex\", got ${ getExt(filePath) }`);
    yellow(`201 Created - Changing LaTeX file path to ${ filePath + ".tex" }...`);
    filePath += ".tex";
    fs.writeFileSync(filePath, new Buffer(""));
    initTex(filePath);
} else if(!filePath.includes("/") && !filePath.includes("\\")) { // Not a path
    //if(/^[a-zA-Z\d_-\s]+\.tex$/.test(filePath.trim())) // English file name
    savedFilename = filePath.replace(/\.tex$/i, "");
    let dir = savedFilename + "_" + getTimeString();
    fs.mkdirSync(path.join(__dirname, "..\\..\\..\\LaTeX", dir));
    console.log(path.join(__dirname, "..\\..\\..\\LaTeX", dir));
    filePath = path.join(__dirname, "..\\..\\..\\LaTeX", dir, filePath);
}

outPath = filePath.replace(/\.tex$/, ".pdf");

let oldHash = null;
let newHash = null;

let quitedProcess = [];

async function init() {
    oldHash = sha256((await readFile(filePath)).toString());
    newHash = oldHash;
    keypress(process.stdin);
    process.stdin.on("keypress", function(ch, key) {
        if ((key && key.ctrl && key.name == "c") || key.name.toLowerCase() === "q") {
            green(`200 OK - Got ${ key.ctrl ? "Ctrl-" : "" }${ key.name }, exiting...`)
            process.exit(0);
        }
    });
    if(!fs.existsSync(filePath.replace(/\.tex$/, ".pdf"))) {
        let buf;
        try {
            buf = cp.execSync(`pdflatex -interaction=batchmode -file-line-error -synctex=1 ${ toPath(filePath) }`, {
                cwd: path.dirname(filePath)
            });
        } catch (e) {
            e.code = 1;
            renderCheck(e, buf, "");
        }
    }
    cp.exec("sublime_text " + toPath(filePath), err => { // fixed the multi-open error
        if(!err) {
            if(new Date().getTime() - start_timestamp > 2000) {
                magenta("404 Not Found - \"Sublime Text 3\" has been closed.");
                quitedProcess.push("sublime_text");
            } else {
                red("500 Internal Server Error - \"Sublime Text 3\" is already running.");
            }
            checkShouldQuit();
        } else
            red("500 Internal Server Error - Failed to start \"Sublime Text 3\" from command line.");
    });
    green("200 OK - \"Sublime Text 3\" started.");
    cp.exec(`SumatraPDF ${ toPath(filePath.replace(/\.tex$/, ".pdf")) }`, err => {
        if(!err) {
            quitedProcess.push("SumatraPDF");
            magenta("404 Not Found - \"Sumatra PDF\" has been closed.");
            checkShouldQuit();
        } else {
            red("500 Internal Server Error - Failed to start \"Sumatra PDF\" from command line.");
            red("If SumatraPDF is started, please ignore this message.");
        }
    });
    green("200 OK - \"Sumatra PDF\" started.");
    while (true) {
        checkHash();
        await sleep(50); // #dontedit# To ensure there're empty ticks in Macrotasks list.
    }
}

async function checkHash() {
    try {
        newHash = sha256((await readFile(filePath)).toString());
        if (oldHash !== newHash) {
            oldHash = newHash;
            yellow("100 Continue - Rendering PDF...");
            renderPDF(filePath);
        } else {
            await sleep(100); // Sleep longer
        }
    } catch (e) {
        fatal(e.stack);
        process.exit(1);
    }
}

/**
 * @method sleep ms milliseconds.
 * @param {number} ms 
 * @return {Promise} for await 
 */
async function sleep(ms) {
    if (ms < 0)
        ms = 0;
    if (ms === 0) {
        return new Promise(resolve => {
            resolve();
        });
    } else {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }
}

var a = 0;

function main() {
    try {
        if(typeof filePath === "string" && filePath.endsWith(".tex") && !fs.existsSync(filePath)) {//tex不存在
            initTex(filePath);
        }
        fs.accessSync(
            filePath,
            (fs.constants || fs).R_OK | (fs.constants || fs).W_OK
        );
    } catch (e) {
        fatal(
            `403 Forbidden - You may not have the access to read/write ${ filePath }`
        );
        process.exit(1);
    }
    init();
}

function renderPDF(p) {
    let time = new Date().getTime();
    cp.exec(
        `pdflatex -interaction=batchmode -file-line-error -synctex=1 ${ toPath(p) }`, {
            cwd: path.dirname(p)
        }, (err, stdout, stderr) => {
            renderCheck(err, stdout, stderr, time);
        });
}

/**
 * @method the Synchronous function of renderPDF
 * @return undefined
 * @param {String} p
 */
function renderPDFSync(p) {
    cp.execSync(
        `pdflatex -interaction=batchmode -file-line-error -synctex=1 ${ toPath(p) }`, {
            cwd: path.dirname(p)
        }, renderCheck);
}

function renderCheck(err, stdout, stderr, time) {
    if (err) {
        red("502 Internal Server Error - Render process exited with code " + err.code + ".");
        red("Outputs are shown below:");
        switch (true) {
            case Boolean(stdout) && Boolean(stderr): // Tricks start
                console.log(`stdout: \n${ "-".repeat(40) } \n${ stdout } \n${ "-".repeat(40) }`);
            case Boolean(stderr):
                console.log(`stderr: \n${ "-".repeat(40) } \n${ stderr } \n${ "-".repeat(40) }`);
                break; // Tricks end
            case Boolean(stdout):
                console.log(`stdout: \n${ "-".repeat(40) } \n${ stdout } \n${ "-".repeat(40) }`);
                break;
            default:
                console.log("\nNo output (- -).\n");
        }
        return; //不自动切换
    } else {
        green(`200 OK - PDF rendered successfully${
            typeof time === "number" ? ` in ${
                new Date().getTime() - time
            } ms` : ""
        }.`);
    }
    if (process.argv[4] === "-l" || process.argv[4] === "--lazy")
        return;
    else {
        cp.exec(`SumatraPDF ${ toPath(outPath) }`, err => {
            if (!err) {
                quitedProcess.push("SumatraPDF");
                magenta("404 Not Found - \"Sumatra PDF\" has been closed.");
                checkShouldQuit();
            } else {
                // ignore this.
            }
        });
        yellow("100 Continue - Switching to \"Sumatra PDF\"...");
    }
}

function showHelpMsg() {
    console.log("Usage: node " + toPath(path.relative(process.cwd(), __filename)) + " [$TeX_File] [OPTIONS]");
    console.log("\nWHERE OPTIONS could be:");
    console.log("  -l, --lazy    To prevent auto-reloading the output PDF.");
}

function checkShouldQuit() {
    const now_timestamp = new Date().getTime();
    if(quitedProcess.includes("sublime_text") && now_timestamp - start_timestamp > 2000) {
        green("200 OK - \"Sublime Text 3\" has been closed and this process will be terminated.");
        process.exit(0);
    }
    return false;
}

/**
 * @param {string} f 
 * @return extension of f
 */
function getExt(f) {
    let arr = f.split(".");
    if(arr.length === 1)
        return null;
    return "." + arr[arr.length - 1];
}

function toPath(str) {
    if (str.includes(" ") && (!str.startsWith('"') && !str.endsWith('"')))
        return `"${ str }"`;
    return str;
}

function getTimeString(sep = "_") {
    const d = new Date();
    return [
        d.getDate(),
        getMonthString(d.getMonth()),
        d.getFullYear(),
        d.toLocaleTimeString().replace(/\:/g, "_")
    ].join(sep);
}

function getMonthString(m) {
    return [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ][m] || "";
}

function initTex(p) {
    try {
        yellow("100 Continue - Generating TeX file...");
        let timeStr;
        let fileDir;
        if(!p) {
            timeStr = getTimeString("-");
            fileDir = path.resolve(__dirname, "..\\..\\..\\LaTeX") + sep + "LaTeX-" + timeStr;
            filePath = fileDir + sep + timeStr + ".tex";
            fs.mkdirSync(fileDir);
        } else {
            filePath = p;
        }
        yellow("100 Continue - Reading template.tex...");
        let template = fs.readFileSync(path.join(__dirname, "template.tex"));
        if(savedFilename !== null) {
            template = template.toString().replace("My Document", savedFilename);
        }
        green("200 OK - Template loaded.")
        yellow("100 Continue - Writing...");
        fs.writeFileSync(filePath, template);
        green(`200 OK - Tex file ${filePath} generated.`);
        yellow("100 Continue - Rendering PDF... (This may spend a few seconds if LaTeX package \"natbib\" isn't installed)");
        let t0 = new Date().getTime();
        renderPDFSync(filePath);
        let t1 = new Date().getTime();
        green(`200 OK - PDF rendered in ${ t1 - t0 } milliseconds.`);
        return true;
    } catch (er) {
        fatal("500 Internal Server Error -", er.name, "-", er.stack);
        process.exit(1);
    }
}

main();
