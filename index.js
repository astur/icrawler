var cheerio = require('cheerio');
var needle = require('needle');
var async = require('async');
var log = require('cllc')(module);


module.exports = function(startURL, opts, parse, done){

    function filterOpts(opts){
        if (Object.prototype.toString.call(opts).slice(8,-1) !== 'Object') return {cookies: {}, headers: {}};
        var o = { cookies: opts.cookies || {}, headers: opts.headers || {} };

        if (opts.open_timeout || opts.timeout) {o.open_timeout = opts.open_timeout || opts.timeout;}
        if (opts.read_timeout) {o.read_timeout = opts.read_timeout;}
        if (opts.connection) {o.connection = opts.connection;}
        if (opts.decode_response === false) {o.decode_response = false;}

        return o;
    }

    function start(){
        init(needle, log, function(err, cookies, headers){
            if(err){
                log.e('Init error:', err.message);
                setTimeout(start, delay);
            } else {
                for(var key in cookies){opts.cookies[key] = cookies[key];}
                for(var key in headers){opts.headers[key] = headers[key];}
                q.resume();
                log.i('Resumed!', new Date());
            }
        });
    }

    function safePush(baseURL){
        return function (url, prior) {
            if (typeof url === 'string') {
                url = [url];
            }
            function _push(url){
                if (!url || typeof url !== 'string') {
                    return false;
                }
                if (baseURL && !/^http/i.test(url)) {
                    url = require('url').resolve(baseURL, url);
                }
                if (passed[url] !== true) {
                    passed[url] = true;
                    q[prior ? 'unshift' : 'push'](url);
                }
                return true;
            }
            while(_push(url.shift())){}
        };
    }

    function getFromArray(arr){
        var i = 0;
        return function(random){
            if (random) return arr[Math.floor(Math.random()*arr.length)];
            if (i >= arr.length) i = 0;
            return arr[i++];
        }
    }

    var result = [];
    var passed = {};

    if (typeof opts === 'function') {
        done = parse;
        parse = opts;
    }

    var concurrency = opts.concurrency || 1;
    var delay = opts.delay || 10000;
    var errorsFirst = !!(opts.errorsFirst);

    var proxyArray = ({String: [opts.proxy], Array: opts.proxy})[Object.prototype.toString.call(opts.proxy).slice(8,-1)];
    var proxyRandom = !(opts.proxyRandom === false);

    var agentArray = ({String: [opts.user_agent], Array: opts.user_agent})[Object.prototype.toString.call(opts.user_agent).slice(8,-1)];
    var agentRandom = !(opts.agentRandom === false);

    var init = opts.init || function (needle, log, cb){process.nextTick(function(){cb(null, {}, {})});}

    opts = filterOpts(opts);

    var getProxy = proxyArray && getFromArray(proxyArray);
    var getAgent = agentArray && getFromArray(agentArray);

    var q = async.queue(function(url, cb){
        if (proxyArray) {
            opts.proxy = proxyRandom ? getProxy(true) : opts.proxy || getProxy();
        }
        if (agentArray) {
            opts.user_agent = agentRandom ? getAgent(true) : opts.user_agent || getAgent();
        }
        needle.get(url, opts, function(err, res){
            if (!err && res.statusCode === 200) {
                var $ = typeof res.body === 'string' ? cheerio.load(res.body) : res.body;
                parse(url, $, {
                    push: safePush(url),
                    save: function(v){result.push(v);},
                    step: log.step,
                    log: log
                }, res);
            } else {
                log.e(url);
                if (!q.paused) {
                    q.pause();
                    log.w('Paused!', new Date());
                    if (proxyArray && !proxyRandom) {opts.proxy = getProxy();}
                    if (agentArray && !agentRandom) {opts.user_agent = getAgent();}
                    setTimeout(start, delay);
                }
                q[errorsFirst ? 'unshift' : 'push'](url);
            }
            cb();
        });
    }, concurrency);

    q.drain = function(){
        log.finish();
        if (done) {
            done(result);
        }
    };

    log.start('%s results found');

    q.pause();
    safePush()(startURL);
    start();
};