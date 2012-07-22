/*!
 * Calipso Core Logging Library
 *
 * Copyright(c) 2011 Clifton Cunningham <clifton.cunningham@gmail.com>
 * MIT Licensed
 *
 * This module exposes the functions that configures the logging of calipso.
 * This is based entirely on Winston.
 *
 */

var app, rootpath = process.cwd(),
  path = require('path'),
  winstong = require('winston'),
  calipso = require(path.join('..', 'calipso'));


/**
 * Core export
 */
exports = module.exports = {
  configureLogging: configureLogging
};

/**
 * Configure winston to provide the logging services.
 *
 * TODO : This can be factored out into a module.
 *
 */

function configureLogging(options) {
  options = options || calipso.config.get('logging');

  //Configure logging
  var logMsg = "\x1b[36mLogging enabled: \x1b[0m",
      winston = require("winston");

  try {
    winston.remove(winston.transports.File);
  } catch (exFile) {
    // Ignore the fault
  }

  if (options.file && options.file.enabled) {
    winston.add(winston.transports.File, {
      level: options.console.level,
      timestamp: options.file.timestamp,
      filename: options.file.filepath
    });
    logMsg += "File @ " + options.file.filepath + " ";
  }

  try {
    winston.remove(winston.transports.Console);
  } catch (exConsole) {
    // Ignore the fault
  }

  if (options.console && options.console.enabled) {
    winston.add(winston.transports.Console, {
      level: options.console.level,
      timestamp: options.console.timestamp,
      colorize: options.console.colorize
    });
    logMsg += "Console ";
  }

  // Temporary data for form
  calipso.data.loglevels = [];
  for (var level in winston.config.npm.levels) {
    calipso.data.loglevels.push(level);
  }

  // Shortcuts to Default
  calipso.log = winston.info; // Default function
  // Shortcuts to NPM levels
  calipso.silly = winston.silly;
  calipso.verbose = winston.verbose;
  calipso.info = winston.info;
  calipso.warn = winston.warn;
  calipso.debug = winston.debug;
  calipso.error = winston.error;

}
