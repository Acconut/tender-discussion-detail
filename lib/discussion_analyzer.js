// Generated by CoffeeScript 1.7.1
(function() {
  var DiscussionAnalyzer, DiscussionFetcher, async, childProcess, config, request;

  request = require("request");

  config = require("./config");

  async = require("async");

  childProcess = require("child_process");

  DiscussionFetcher = require("./discussion_fetcher");

  DiscussionAnalyzer = (function() {
    function DiscussionAnalyzer() {
      this._filtered = [];
    }

    DiscussionAnalyzer.prototype.start = function(fn, cb) {
      var fetcher, opts;
      if (!config.tender.siteName || !config.tender.apiKey) {
        throw new Error("You need to supply Tender credentials!");
      }
      opts = {
        site: config.tender.siteName,
        apiKey: config.tender.apiKey,
        state: config.state
      };
      fetcher = new DiscussionFetcher(opts);
      return fetcher.fetch((function(_this) {
        return function(err, discussions) {
          if (err) {
            throw err;
          }
          return _this._filterDiscussions(discussions, function(err) {
            if (err) {
              throw err;
            }
            return _this._fetchStatsForDiscussions(_this._filtered, fn, cb);
          });
        };
      })(this));
    };

    DiscussionAnalyzer.prototype._filterDiscussions = function(discussions, cb) {
      var q;
      if (discussions.length === 0) {
        return cb();
      }
      q = async.queue(this._filter.bind(this), 1);
      q.drain = cb;
      return q.push(discussions);
    };

    DiscussionAnalyzer.prototype._filter = function(discussion, cb) {
      var hoursAgo, now, result, thenTime;
      result = [];
      if (config.hoursAgo) {
        now = +(new Date);
        hoursAgo = +new Date(now - (config.hoursAgo * 60 * 60 * 1000));
        thenTime = +new Date(discussion.created_at);
        if (thenTime < hoursAgo) {
          return cb();
        }
      }
      return this._fetchComments(discussion.href, (function(_this) {
        return function(err, result) {
          var comment, hasComment, matches, _i, _len, _ref;
          if (err) {
            return cb(err);
          }
          hasComment = false;
          _ref = result.comments;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            comment = _ref[_i];
            matches = comment.internal === config.formData.internal;
            matches = matches && comment.author_email === config.formData.authorEmail;
            matches = matches && /^\#Script generated/.test(comment.body);
            if (matches) {
              hasComment = true;
              break;
            }
          }
          if (!hasComment) {
            _this._filtered.push(discussion);
          }
          return cb();
        };
      })(this));
    };

    DiscussionAnalyzer.prototype._fetchStatsForDiscussions = function(discussions, fn, cb) {
      var d, index, obj, q, _i, _len, _results;
      if (discussions.length === 0) {
        return cb();
      }
      q = async.queue(this._fetchStats.bind(this), 1);
      q.drain = cb;
      index = 1;
      _results = [];
      for (_i = 0, _len = discussions.length; _i < _len; _i++) {
        d = discussions[_i];
        obj = {
          index: index++,
          total: discussions.length,
          fn: fn,
          discussion: d
        };
        _results.push(q.push(obj));
      }
      return _results;
    };

    DiscussionAnalyzer.prototype._fetchStats = function(obj, cb) {
      var discussion, fn, index, total;
      discussion = obj.discussion;
      index = obj.index;
      total = obj.total;
      fn = obj.fn;
      return fn(discussion, (function(_this) {
        return function(err, data) {
          var formData, opts;
          if (err) {
            throw err;
          }
          formData = JSON.parse(JSON.stringify(config.formData));
          formData.body = _this._fillPlaceholders(formData.body, data);
          formData.body = "#Script generated " + formData.body;
          opts = {
            url: discussion.comments_href,
            form: formData,
            headers: {
              "X-Tender-Auth": config.tender.apiKey,
              "Accept": "application/vnd.tender-v1+json",
              "Content-Type": "application/json"
            }
          };
          return request.post(opts, function(err, resp, body) {
            if (err) {
              throw err;
            }
            console.log("" + index + " / " + total + ": Handled " + discussion.html_href);
            return cb();
          });
        };
      })(this));
    };

    DiscussionAnalyzer.prototype._fetchComments = function(href, cb) {
      var cmd;
      cmd = ["curl"];
      cmd.push("-H \"Accept: application/vnd.tender-v1+json\"");
      cmd.push("-H \"X-Tender-Auth: " + config.tender.apiKey + "\"");
      cmd.push("-H \"Content-Type: application/json\"");
      cmd = cmd.join(" ");
      cmd += " " + href;
      return childProcess.exec(cmd, (function(_this) {
        return function(err, stdout, stderr) {
          var e, parsed;
          parsed = null;
          try {
            parsed = JSON.parse(stdout);
          } catch (_error) {
            e = _error;
            return cb(e);
          }
          return cb(err, parsed);
        };
      })(this));
    };

    DiscussionAnalyzer.prototype._fillPlaceholders = function(body, dataToReplace) {
      var key, regex, val;
      for (key in dataToReplace) {
        val = dataToReplace[key];
        regex = new RegExp("\{" + key + "\}");
        body = body.replace(regex, val);
      }
      return body;
    };

    return DiscussionAnalyzer;

  })();

  module.exports = DiscussionAnalyzer;

}).call(this);