/**
 * This is a modified version of the cron.js library referrred to below
 *
 * I needed to modify it to enable management of jobs, not just creating of them.
 *
 */

/**
 * cron.js
 * ---
 * VERSION 0.1
 * ---
 * @author James Padolsey
 * ---
 * Dual licensed under the MIT and GPL licenses.
 *    - http://www.opensource.org/licenses/mit-license.php
 *    - http://www.gnu.org/copyleft/gpl.html
 */
var sys;
try {
  sys = require('util');
}
catch (e) {
  sys = require('sys');
}
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso'));

function CronTime(time) {

  this.source = time;
  this.map = ['second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];
  this.constraints = [
    [0, 59],
    [0, 59],
    [0, 23],
    [1, 31],
    [0, 11],
    [1, 7]
  ];
  this.aliases = {
    jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11, sun:1, mon:2, tue:3, wed:4, thu:5, fri:6, sat:7
  };

  this.second = {};
  this.minute = {};
  this.hour = {};
  this.dayOfMonth = {};
  this.month = {};
  this.dayOfWeek = {};

  this._parse();

};

CronTime.prototype = {

  _parse:function () {

    var aliases = this.aliases,
      source = this.source.replace(/[a-z][a-z][a-z]/ig, function (alias) {

        alias = alias.toLowerCase();

        if (alias in aliases) {
          return aliases[alias];
        }

        throw new Error('Unknown alias: ' + alias);

      }),
      split = source.replace(/^\s\s*|\s\s*$/g, '').split(/\s+/),
      cur, len = 6;

    while (len--) {
      cur = split[len] || '*';
      this._parseField(cur, this.map[len], this.constraints[len]);
    }

  },
  _parseField:function (field, type, constraints) {

    var rangePattern = /(\d+?)(?:-(\d+?))?(?:\/(\d+?))?(?:,|$)/g,
      typeObj = this[type],
      diff,
      low = constraints[0],
      high = constraints[1];

    // * is a shortcut to [lower-upper] range
    field = field.replace(/\*/g, low + '-' + high);

    if (field.match(rangePattern)) {

      field.replace(rangePattern, function ($0, lower, upper, step) {

        step = parseInt(step) || 1;

        // Positive integer higher than constraints[0]
        lower = Math.max(low, ~~Math.abs(lower));

        // Positive integer lower than constraints[1]
        upper = upper ? Math.min(high, ~~Math.abs(upper)) : lower;

        // Count from the lower barrier to the upper
        pointer = lower;

        do {
          typeObj[pointer] = true
          pointer += step;
        }
        while (pointer <= upper);

      });

    } else {

      throw new Error('Field (' + field + ') cannot be parsed');

    }

  }
};

function CronJob(options) {

  if (!(this instanceof CronJob)) {
    return new CronJob(options);
  }

  this.configure(options);

}

CronJob.prototype = {

  configure:function (options) {

    options = options ? options : {jobName:'',
      cronTime:'* * * * * *',
      enabled:true,
      module:'',
      method:'',
      events:'',
      args:''
    }

    // Set options
    this.jobName = options.jobName;
    this.fn = options.fn;
    this.enabled = options.enabled;
    this.module = options.module;
    this.method = options.method;
    this.args = options.args;
    this.blocking = options.blocking ? options.blocking : true;

    // calculation holders
    this.now = {};
    this.running = false;
    this.initiated = false;
    this.invalid = false;

    try {
      this.cronTime = new CronTime(options.cronTime);
    }
    catch (ex) {
      this.invalid = true;
      this.enabled = false;
    }
    this.cronTimeString = options.cronTime;
    this.clock();
  },
  enable:function () {
    if (!this.invalid) {
      this.enabled = true;
    }
    this.clock();
  },
  disable:function () {
    this.enabled = false;
    this.clock();
  },
  executeJob:function () {
    if (typeof this.fn === 'function' && !(this.blocking && this.running)) {

      // Job starter
      this.jobStart();
      // Create the callback wrapper
      // TODO : This doesn't feel right?
      var job = this;

      function jobFinish(err) {
        job.jobFinish(job, err);
      }

      this.fn(this.args, jobFinish);
    }
  },
  jobStart:function () {
    this.running = true;
    this.jobStarted = new Date;
    calipso.debug("Job " + this.jobName + " started @ " + this.jobStarted);
  },
  jobFinish:function (job, err) {
    this.running = false;
    this.jobFinished = new Date;
    if (!err) {
      calipso.debug("Job " + job.jobName + " completed in " + (job.jobFinished - job.jobStarted) + " ms");
    } else {
      calipso.error("Job " + job.jobName + " completed with an error: " + err);
    }

  },
  clock:function () {

    if (!this.enabled) {
      return;
    }

    var date = new Date,
      now = this.now,
      self = this,
      cronTime = this.cronTime,
      i;

    if (!this.initiated) {
      // Make sure we start the clock precisely ON the 0th millisecond
      setTimeout(function () {
        self.initiated = true;
        self.clock();
      }, Math.ceil(+date / 1000) * 1000 - +date);
      return;
    }

    this.timer = this.timer || setInterval(function () {
      self.clock();
    }, 1000);

    now.second = date.getSeconds();
    now.minute = date.getMinutes();
    now.hour = date.getHours();
    now.dayOfMonth = date.getDate();
    now.month = date.getMonth();
    now.dayOfWeek = date.getDay() + 1;

    for (i in now) {
      if (!(now[i] in cronTime[i])) {
        return;
      }
    }

    this.executeJob();

  }

};

/**
 * Timer helper functions
 */
function jobStart() {
  calipso.debug("Job Started " + this.jobName);
}

function jobFinish(err) {
  calipso.debug("Job Started " + this.jobName);
}

exports.CronJob = CronJob;
exports.CronTime = CronTime;
