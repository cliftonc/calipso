/*!
 * Calipso Core Library
 * Copyright(c) 2011 Clifton Cunningham
 * MIT Licensed
 *
 * The Calipso Router provides a router object to each module that enables each module to register
 * its own functions to respond to URL patterns (as per the typical Express approach).  Note
 * that Calipso itself does not respond to any URL outside of those exposed by a module, if all are disabled
 * the application will do nothing.
 *
 * Borrowed liberally from Connect / ExpressJS itself for this, thanks for the great work!
 */

/**
 * Includes
 */
var url = require('url'),
  fs = require('fs'),
  path = require('path'),
  blocks = require('lib/Blocks'),
  calipso = require('lib/calipso');

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * BORROWED FROM Connect
 *
 * @param  {String} path
 * @param  {Array} keys
 * @return {RegExp}
 * @api private
 */

function normalizePath(path, keys) {
  path = path
    .concat('/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g, function (_, slash, format, key, capture, optional) {
      keys.push(key);
      slash = slash || '';
      return ''
        + (optional ? '' : slash)
        + '(?:'
        + (optional ? slash : '')
        + (format || '') + (capture || '([^/]+?)') + ')'
        + (optional || '');
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.+)');

  return new RegExp('^' + path + '$', 'i');
}


/**
 * Core router object, use the return model to ensure
 * that we always return a new instance when called.
 *
 * A Router is attached to each module, and allows each module to effectively
 * act as its own controller in a mini MVC model.
 *
 * This class exposes:
 *
 *     addRoutes: function, to add Routes to a module.
 *     route: iterate through the routes, match, and then call the matched function in the module.
 *
 */
var Router = function (moduleName, modulePath) {

  return {

    moduleName: moduleName,
    modulePath: modulePath,
    routes: [],

    /**
     * A route is defined by three parameters:
     *
     * path:  a string in the form 'GET /url' where the first piece is the HTTP method to respond to.
     *        OR
     *        a regex function (it matches only on GET requests).
     * fn:    the function in the module to call if the route matches.
     * options: additional configuration options, specifically:
     *    end - deprecated. TODO CLEANUP
     *    admin - is the route an administrative route (user must have isAdmin = true).
     */
    addRoute: function (path, fn, options, next) {

      var router = this;

      // Default options
      options = options || {end: true, admin: false};

      // Can't do any real checking here as everything is initialised in parallel.
      router.routes.push({path: path, fn: fn, options: options});
      next();

    },
    /**
     * Module routing function, iterates through the configured routes and trys to match.
     * This has been borrowed from the Express core routing module and refactored slightly
     * to deal with the fact this is much more specific.
     */
    route: function (req, res, next) {

      var router = this,
        requestUrl = url.parse(req.url, true),
        routes = this.routes;

      // Use step to enable parallel execution
      calipso.lib.step(
        function matchRoutes() {

          // Emit event to indicate starting
          var i, l, group = this.group(), // Enable parallel execution
            counter = 0;

          for (i = 0, l = routes.length; i < l; i = i + 1) {

            var keys = [],
              route = routes[i],
              template = null,
              block = "",
              cache = true,
              routeMethod = "",
              routeRegEx,
              j,
              paramLen,
              param,
              allPages = false;

            if (typeof route.path === "string") {
              routeMethod = route.path.split(" ")[0];
              routeRegEx = normalizePath(route.path.split(" ")[1], keys);
            } else {
              routeRegEx = route.path;
              allPages = true; // Is a regex
            }

            var captures = requestUrl.pathname.match(routeRegEx);

            if (captures && (!routeMethod || req.method === routeMethod)) {

              // Check to see if we matched a non /.*/ route to flag a 404 later
              res.routeMatched = !allPages || res.routeMatched;

              // If admin, then set the route
              if (route.options.admin) {
                res.layout = "admin";
              }

              // Check to see if it requires admin access
              var isAdmin = req.session.user && req.session.user.isAdmin;
              if (route.options.admin && !isAdmin) {
                req.flash('error', req.t('You need to be an administrative user to view that page.'));
                res.statusCode = 401;
                res.redirect("/");
                group()();
                return;
              }

              // Debugging
              calipso.silly("Module " + router.moduleName + " matched route: " + requestUrl.pathname + " / " + routeRegEx.toString() + " [" + res.routeMatched + "]");

              // Lookup the template for this route
              if (route.options.template) {
                template = calipso.modules[router.moduleName].templates[route.options.template];
                if (!template && route.options.template) {
                  var err = new Error("The specified template: " + route.options.template + " does not exist in the module: " + router.modulePath);
                  return group()(err);
                } else {
                  calipso.silly("Using template: " + route.options.template + " for module: " + router.modulePath);
                }
              }

              // Set the block & cache settings
              block = route.options.block;

              // Set the object to hold the rendered blocks if it hasn't been created already
              if (!res.renderedBlocks) {
                res.renderedBlocks = new blocks.RenderedBlocks(calipso.cache);
              }

              // Copy over any params that make sense from the url
              req.moduleParams = {};
              for (j = 1, paramLen = captures.length; j < paramLen; j = j + 1) {
                var key = keys[j - 1],
                  val = typeof captures[j] === 'string'
                    ? decodeURIComponent(captures[j])
                    : captures[j];
                if (key) {
                  req.moduleParams[key] = val;
                } else {
                  // Comes from custom regex, no key
                  req.moduleParams["regex"] = val;
                }
              }

              // Convert any url parameters if we are not a .* match
              if (requestUrl.query && !allPages) {
                for (param in requestUrl.query) {
                  if (requestUrl.query.hasOwnProperty(param)) {
                    req.moduleParams[param] = requestUrl.query[param];
                  }
                }
              }

              // Store the params for use outside the router
              res.params = res.params || {};
              calipso.lib._.extend(res.params,req.moduleParams);

              // Set if we should cache this block - do not cache by default, do not cache admins
              var cacheBlock = res.renderedBlocks.contentCache[block] = route.options.cache && !isAdmin;
              var cacheEnabled = calipso.config.cache;
              if(block && cacheBlock && cacheEnabled) {

                //console.dir(req.moduleParams);
                var cacheKey = calipso.helpers.getCacheKey('block',block,true);

                calipso.cache.check(cacheKey,function(err,isCached) {
                    if(isCached) {
                      // Set the block from the cache, set layout if needed
                      res.renderedBlocks.getCache(cacheKey,block,function(err,layout) {
                          if(layout)
                             res.layout = layout;
                          group()(err);
                      });
                    } else {
                      // Execute the module route function and cache the result
                      route.fn(req, res, template, block, group());
                    }
                });

              } else {

                route.fn(req, res, template, block, group());

              }

            }
          }
        },

        function allMatched(err) {

          // Once all functions have been called, log the error and pass it back up the tree.
          if (err) {
            // Enrich the error message with info on the module
            // calipso.error("Error in module " + this.moduleName + ", of " + err.message);
            err.message = err.message + " Calipso Module: " + router.moduleName;
          }

          // Emit routed event
          next(err, router.moduleName);

        }
      );

    }

  };

};

/**
 * Exports
 */
module.exports.Router = Router;
