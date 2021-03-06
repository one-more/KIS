'use strict';

const BaseView = require('./base'),
    $ = require('jquery'),
    AjaxResponse = require('../classes/ajax-response');

module.exports = class extends BaseView {
    constructor() {
        super();
        this.disable();
        this.waitForDependencies().then(this.enable.bind(this))
    }

    disable() {
        this.$('button, [type=submit]').attr('disabled', 'true')
    }

    enable() {
        this.$('button, [type=submit]').removeAttr('disabled')
    }

    showProgress() {

    }

    hideProgress() {

    }

    get events() {
        return {
            'submit': 'submit'
        }
    }

    waitForDependencies() {
        return new Promise(resolve => {
            const commonEvents = require('../events/common');
            if(app.get('validationEngine')) {
                resolve()
            } else {
                commonEvents.on('init validationEngine', resolve)
            }
        })
    }

    submit(event) {
        event.preventDefault();

        this.waitForDependencies().then(() => {
            const form = event.target,
                data = this.validate(this.serializeData(form));
            if(data) {
                this.send(form.action, this.processData(data, form)).then(result => {
                    if(this.isRequestSuccess(result)) {
                        this.onSuccess(result)
                    } else {
                        this.onError(result)
                    }
                })
            } else {
                this.onValidationError()
            }
        })
    }

    processData(data) {
        return data
    }

    isRequestSuccess(result) {
        return result.status == AjaxResponse.statusOK
    }

    onSuccess() {}

    onError() {}

    serializeData(form) {
        return this.toJSON(form)
    }

    send(url, data) {
        const showProgress = this.showProgress.bind(this);
        return $.ajax({
            url,
            xhr() {
                const xhr = new XMLHttpRequest();
                showProgress(xhr);
                return xhr
            },
            data,
            dataType: 'json'
        }).then(result => {
            this.hideProgress();
            return result
        }).fail(err => {
            this.hideProgress()
        })
    }

    toJSON(form) {
        let json = {},
            push_counters = {},
            patterns = {
                "validate": /^[a-zA-Z][a-zA-Z0-9_]*(?:\[(?:\d*|[a-zA-Z0-9_]+)\])*$/,
                "key":      /[a-zA-Z0-9_-]+|(?=\[\])/g,
                "push":     /^$/,
                "fixed":    /^\d+$/,
                "named":    /^[a-zA-Z0-9_]+$/
            };


        let build = (base, key, value) => {
            base[key] = value;
            return base;
        };

        let pushCounter = key => {
            if(push_counters[key] === undefined){
                push_counters[key] = 0;
            }
            return push_counters[key]++;
        };

        $.each($(form).serializeArray().concat(this.getUncheckedCheckboxes()), function() {
            // skip invalid keys
            if(!patterns.validate.test(this.name)){
                return;
            }

            let k,
                keys = this.name.match(patterns.key),
                merge = this.value,
                reverse_key = this.name;

            while((k = keys.pop()) !== undefined) {
                // adjust reverse_key
                reverse_key = reverse_key.replace(new RegExp("\\[" + k + "\\]$"), '');

                // push
                if(k.match(patterns.push)){
                    merge = build([], pushCounter(reverse_key), merge);
                }

                // fixed
                else if(k.match(patterns.fixed)){
                    merge = build([], k, merge);
                }

                // named
                else if(k.match(patterns.named)){
                    merge = build({}, k, merge);
                }
            }

            json = $.extend(true, json, merge);
        });

        return json;
    }

    getUncheckedCheckboxes() {
        return this.$('[type=checkbox]:not(:checked)').toArray().map(el => {
            return {
                name: el.name,
                value: ''
            }
        })
    }

    validate(data) {
        return data
    }

    onValidationError() {}
};