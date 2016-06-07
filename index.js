var cheerio = require('cheerio');
var needle = require('needle');
var tress = require('tress');
var log = require('cllc')(module);
var onDeath = require('death');
var fs = require('fs');


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

    function start(isStart){
        var message = isStart ? 'Started!' : 'Resumed!';
        if (proxyArray && !proxyRandom) {opts.proxy = getProxy();}
        if (agentArray && !agentRandom) {opts.user_agent = getAgent();}
        if (isStart) {
        }
        if (isStart || initOnError) {
            init(needle, log, function(err, cookies, headers){
                if(err){
                    log.e('Init error: ' + err.message);
                    setTimeout(start, delay);
                } else {
                    cleanCookiesOnInit && (opts.cookies = {});
                    cleanHeadersOnInit && (opts.headers = {});
                    for(var key in cookies){opts.cookies[key] = cookies[key];}
                    for(var key in headers){opts.headers[key] = headers[key];}
                    q.resume();
                    log.i(message);
                }
            });
        } else {
            q.resume();
            log.i(message);
        }
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
                q[prior ? 'unshift' : 'push'](url);
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

    function work(url, cb){
        count++;
        if (proxyArray && proxyRandom) {opts.proxy = getProxy(true);}
        if (agentArray && agentRandom) {opts.user_agent = getAgent(true);}
        if (saveOnCount && count % saveOnCount === 0) {save();}
        needle.get(url, opts, function(err, res){
            if (!err && res.statusCode === 200 && !q.paused) {
                var $ = (typeof res.body === 'string' && !noJquery) ? cheerio.load(res.body) : res.body;
                var _ = {
                    push: safePush(url),
                    save: function(v){results.push(v);},
                    step: log.step,
                    log: log
                }
                if (asyncParse) {
                    _.cb = function(){
                        cb();
                    };
                    parse(url, $, _, res);
                } else {
                    parse(url, $, _, res);
                    cb();
                }
            } else {
                if (!q.paused) {
                    q.pause();
                    saveOnError && save();
                    log.w('Paused!');
                    setTimeout(start, delay);
                }
                log.e(url);
                q[errorsFirst ? 'unshift' : 'push'](url);
                // retry - cb(errorsFirst)
                cb();
            }
        });
    }

    var count = 0;

    if (typeof opts === 'function') {
        done = parse;
        parse = opts;
    }

    var concurrency = opts.concurrency || 1;
    var delay = opts.delay || 10000;
    var errorsFirst = !!(opts.errorsFirst);
    var noJquery = opts.noJquery || false;

    var proxyArray = ({String: [opts.proxy], Array: opts.proxy})[Object.prototype.toString.call(opts.proxy).slice(8,-1)];
    var proxyRandom = !(opts.proxyRandom === false);

    var agentArray = ({String: [opts.user_agent], Array: opts.user_agent})[Object.prototype.toString.call(opts.user_agent).slice(8,-1)];
    var agentRandom = !(opts.agentRandom === false);

    var init = opts.init || function (needle, log, cb){process.nextTick(function(){cb(null, {}, {})});}
    var initOnError = !(opts.initOnError === false);
    var cleanCookiesOnInit = opts.cleanCookiesOnInit || false;
    var cleanHeadersOnInit = opts.cleanHeadersOnInit || false;

    var save = (function(saveF, fileN){
        return function(){
            if (fileN) {
                q.save(function(tasks){
                    fs.writeFileSync(fileN, JSON.stringify({tasks: tasks, results: results}, null, 4))
                });
            } else if (typeof saveF === 'function'){
                q.save(function(tasks){
                    saveF(tasks, results);
                });
            }
        };
    })(opts.save, opts.file)

    var saveOnError = !(opts.saveOnError === false);
    var saveOnFinish = !(opts.saveOnFinish === false);
    var saveOnExit = !(opts.saveOnExit === false);
    var saveOnCount = opts.saveOnCount || false;

    var asyncParse = opts.asyncParse || false;

    var getProxy = proxyArray && getFromArray(proxyArray);
    var getAgent = agentArray && getFromArray(agentArray);

    var results = opts.results || [];

    var q = tress(work, concurrency);

    q.pause();

    q.drain = function(){
        log.finish();
        saveOnFinish && save();
        if (done) {
            done(results);
        }
    };

    if (opts.file && fs.existsSync(opts.file)) {
        var obj = JSON.parse(fs.readFileSync(opts.file, 'utf8'));
        results = obj.results;
        q.load(obj.tasks);
    } else if (opts.tasks) {
        q.load(opts.tasks);
    } else {
        q.push(startURL);
    }

    log.start('%s results found', results.length);

    opts = filterOpts(opts);

    start(true);

    onDeath(function() {
        log.finish();
        saveOnExit && save();
        process.exit();
    });
};