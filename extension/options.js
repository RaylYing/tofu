import Settings from './settings.js';
import {SERVICE_SETTINGS} from './service.js';
import Notification from './ui/notification.js';


class TabPanel {
    constructor(panelSelector, tabSelector, contentSelector) {
        this.$panel = $(panelSelector);
        this.$tabs = $(tabSelector);
        this.$contents = $(contentSelector);

        this.$panel.on('click', '.page-tab-link', event => {
            let tab = event.currentTarget;
            if (tab.classList.contains('is-active')) {
                return false;
            }
            this.toggle(tab.dataset.tab, tab);
        });

        window.addEventListener('hashchange', e => {
            if (location.hash) {
                this.toggle(location.hash.substr(1));
            }
        }, false);

        if (location.hash) {
            this.toggle(location.hash.substr(1));
        }
    }

    toggle(tabName, tab) {
        if (!tab) {
            tab = this.$tabs.find('[href="#' + tabName + '"]').parent('li')[0];
        }
        this.$tabs.removeClass('is-active');
        this.$contents.addClass('is-hidden');
        tab.classList.add('is-active');
        this.$contents.each((_, el) => {
            if (el.getAttribute('name') == tabName) {
                el.classList.remove('is-hidden');
            }
        });
    }

    static render() {
        return new TabPanel('.page-tab-panel',
                            '.page-tab-link',
                            '.page-tab-content');
    }
}


class AccountPanel {
    constructor(successSelector, errorSelector) {
        this.panel = document.querySelector(successSelector);
        this.error = document.querySelector(errorSelector);
    }

    async load() {
        let cookies = await new Promise(resolve => chrome.cookies.getAll({url: 'https://*.douban.com'}, resolve));
        let uid, ck;
        for (let cookie of cookies) {
            switch (cookie.name) {
                case 'dbcl2':
                    uid = parseInt(cookie.value.match(/^\"(\w*):.+\"$/)[1]);
                    break;
                case 'ck':
                    ck = cookie.value;
                    break;
            }
        }
        let response = await fetch(`https://m.douban.com/rexxar/api/v2/user/${uid}?ck=${ck}`, {headers: {'X-Override-Referer': 'https://m.douban.com/'}});
        if (response.status != 200) {
            this.error.classList.remove('is-hidden');
        }
        let userInfo = await response.json();
        this.panel.querySelector('.media-left>.image').innerHTML = `<img src="${userInfo.avatar}">`;
        this.panel.querySelector('.media-content [name="name"]').innerText = userInfo.name;
        this.panel.querySelector('.media-content [name="symbol"]').innerText = 'ID: ' + userInfo.uid;
        let collectionPanel = this.panel.querySelector('.media-content [name="collection"]');
        let collection = {
            '关注': {key: 'following_count', url: 'https://www.douban.com/contacts/list'},
            '被关注': {key: 'followers_count', url: 'https://www.douban.com/contacts/rlist'},
            '日记': {key: 'notes_count', url: 'https://www.douban.com/mine/notes'},
            '相册': {key: 'photo_albums_count', url: 'https://www.douban.com/mine/photos'},
            '小组': {key: 'joined_group_count', url: 'https://www.douban.com/group/mine'},
            '广播': {key: 'statuses_count', url: 'https://www.douban.com/mine/statuses'},
            '豆列': {key: 'owned_doulist_count', url: 'https://www.douban.com/mine/doulists'},
        };
        for (let item in collection) {
            let column = document.createElement('DIV');
            let url = collection[item].url;
            let key = collection[item].key;
            column.classList.add('column');
            column.innerHTML = `<p class="has-text-centered"><a href="${url}" target="_blank">${userInfo[key]}<br>${item}</a></p>`
            collectionPanel.appendChild(column);
        }
        this.panel.classList.remove('is-hidden');
    }

    static async render() {
        let panel = new AccountPanel('#account',
                                     '#account-error');
        let account = await panel.load();
    }
}


class GeneralSettings {
    constructor(selector, settings, defaults) {
        this.panel = document.querySelector(selector);
        this.settings = settings;
        this.defaults = defaults;

        const CONTROL_NAMES = [
            'service.debug',
            'service.requestInterval',
            'save',
            'reset',
        ];
        let controls = {};
        for (let controlName of CONTROL_NAMES) {
            controls[controlName] = this.panel.querySelector(`[name="${controlName}"]`)
        }
        this.controls = controls;

        if (!settings[CONTROL_NAMES[0]]) {
            controls[CONTROL_NAMES[0]].removeAttribute('checked');
        }
        controls[CONTROL_NAMES[1]].value = settings[CONTROL_NAMES[1]] / 1000;

        controls.save.addEventListener('click', event => {
            this.settings['service.debug'] = this.controls['service.debug'].checked;
            this.settings['service.requestInterval'] = parseFloat(this.controls['service.requestInterval'].value) * 1000;
            this.save(this.settings);
        });
        controls.reset.addEventListener('click', event => {
            $(this.controls['service.debug']).prop('checked', this.defaults['service.debug']).trigger('change');
            this.controls['service.requestInterval'].value = this.defaults['service.requestInterval'] / 1000;
            this.save(this.defaults);
        });

        let switches = this.panel.querySelectorAll('.is-switch');
        switches.forEach(el => new Switchery(el));
    }

    save(settings) {
        try {
            chrome.storage.sync.set(settings, result => {
                Notification.show('保存成功');
            });
        } catch (e) {
            Notification.show('保存失败', {type: 'danger'});
        }
    }

    static async render() {
        let settings = await Settings.load(SERVICE_SETTINGS);
        let defaults = SERVICE_SETTINGS;
        return new GeneralSettings('.page-tab-content[name="general"]', settings, defaults);
    }
}


TabPanel.render();
AccountPanel.render();
GeneralSettings.render();