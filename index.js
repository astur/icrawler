var cheerio = require('cheerio');
var needle = require('needle');
var tress = require('tress');
var log = require('cllc')(module);
var onDeath = require('death');
var fs = require('fs');
var resolve = require('url').resolve;


module.exports = function(startData, opts, parse, done){

    function type(obj){
        return Object.prototype.toString.call(obj).slice(8,-1);
    }

    function filterOpts(opts){
        if (type(opts) !== 'Object') return {cookies: {}, headers: {}, read_timeout: 10000};
        var o = { cookies: opts.cookies || {}, headers: opts.headers || {} };

        if (opts.open_timeout || opts.timeout) {o.open_timeout = opts.open_timeout || opts.timeout;}
        o.read_timeout = opts.read_timeout || 10000;
        if (opts.connection) {o.connection = opts.connection;}
        if (opts.decode_response === false) {o.decode_response = false;}

        return o;
    }

    function start(isStart){
        var message = isStart ? 'Started!' : 'Resumed!';
        if (proxyArray && !proxyRandom) {opts.proxy = getProxy();}
        if (agentArray && !agentRandom) {opts.user_agent = getAgent();}
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

    function getFromArray(arr){
        var i = 0;
        return function(random){
            if (random) return arr[Math.floor(Math.random()*arr.length)];
            if (i >= arr.length) i = 0;
            return arr[i++];
        }
    }

    function inArray(arr, item){
        return !!arr.filter((v)=>{
            return v.url === item.url;
        }).length;
    }

    function newTasksResolve(tasks, baseUrl){
        type(tasks) !== 'Array' && (tasks = [tasks]);
        var newArr = [];
        for (var i = 0; i < tasks.length; i++) {
            if(typeof tasks[i] === 'string'){
                tasks[i] = {url: tasks[i]};
            }

            if (baseUrl && !/^https?:/i.test(tasks[i].url)) {
                tasks[i].url = resolve(baseUrl, tasks[i].url);
            }
            if (!skipDuplicates  ||
                !inArray(q.waiting, tasks[i]) &&
                !inArray(q.active, tasks[i]) &&
                !inArray(q.failed, tasks[i]) &&
                !inArray(q.finished, tasks[i]) &&
                !inArray(newArr, tasks[i])) {
                    newArr.push(tasks[i]);
            }
        }
        return newArr;
    }

    function onSuccess(task, res, cb){
        var tasksForUnshift = [];
        var tasksForPush = [];
        var newResults = [];
        var $ = (typeof res.body === 'string' && !noJquery) ? cheerio.load(res.body) : res.body;
        var _ = {
            push: function(newTask, prior){
                if (prior) {
                    tasksForUnshift.push(newTask);
                } else {
                    tasksForPush.push(newTask);
                }
            },
            save: function(result){
                newResults.push(result);
            },
            step: log.step,
            log: log
        }
        function onParse(){
            q.unshift(newTasksResolve(tasksForUnshift, task.url));
            q.push(newTasksResolve(tasksForPush, task.url));
            while(newResults.length > 0){
                results.push(newResults.shift());
            }
        }
        if (asyncParse) {
            _.cb = function(){
                onParse();
                cb.apply(null, arguments);
            };
            parse(task, $, _, res);
        } else {
            parse(task, $, _, res);
            onParse();
            cb();
        }
    }

    function onError(err, task, cb){
        if (!q.paused) {
            q.pause();
            log.e(err, task.url);
            saveOnError && save();
        }
        if (q.running() === 1){
            log.i('Paused!');
            setTimeout(start, delay);
        }
        cb(errorsFirst);
    }

    function work(task, cb){
        if (ctrlCPressed){
            log.finish();
            log.i('Aborted by user.');
            saveOnExit && save();
            process.exit();
        }
        if (proxyArray && proxyRandom) {opts.proxy = getProxy(true);}
        if (agentArray && agentRandom) {opts.user_agent = getAgent(true);}
        if (saveOnCount && count++ % saveOnCount === 0) {save();}
        needle.get(task.url, opts, function(err, res){
            if (!err && allowedStatuses.indexOf(res.statusCode) > -1 && !q.paused) {
                onSuccess(task, res, cb);
            } else {
                onError(err || res.statusCode, task, cb);
            }
        });
    }

    var count = 0;
    var ctrlCPressed = false;

    if (typeof opts === 'function') {
        done = parse;
        parse = opts;
    }

    var concurrency = opts.concurrency || 1;
    var delay = opts.delay || 10000;
    var errorsFirst = !!(opts.errorsFirst);
    var noJquery = opts.noJquery || false;
    var skipDuplicates = !(opts.skipDuplicates === false);

    var allowedStatuses = opts.allowedStatuses ? [].concat(opts.allowedStatuses) : [200];

    var proxyArray = ({String: [opts.proxy], Array: opts.proxy})[type(opts.proxy)];
    var proxyRandom = !(opts.proxyRandom === false);

    var agentArray = ({String: [opts.user_agent], Array: opts.user_agent})[type(opts.user_agent)];
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
        log.i('Finished!')
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
        q.push(newTasksResolve(startData));
    }

    log.start('%s results found', results.length);

    opts = filterOpts(opts);

    start(true);

    onDeath(function() {
        ctrlCPressed = true;
        setTimeout(function(){
            log.finish();
            log.e('Aborted by user. Last data not saved.')
            process.exit();
        }, 1000);
    });
};