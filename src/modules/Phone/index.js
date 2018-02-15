import 'whatwg-fetch';
import SDK from 'ringcentral';
import RingCentralClient from 'ringcentral-client';

import { ModuleFactory } from 'ringcentral-integration/lib/di';
import RcModule from 'ringcentral-integration/lib/RcModule';

import Alert from 'ringcentral-integration/modules/Alert';
import Brand from 'ringcentral-integration/modules/Brand';

import ConnectivityMonitor from 'ringcentral-integration/modules/ConnectivityMonitor';
import DateTimeFormat from 'ringcentral-integration/modules/DateTimeFormat';
import GlobalStorage from 'ringcentral-integration/modules/GlobalStorage';
import Locale from 'ringcentral-integration/modules/Locale';
import RateLimiter from 'ringcentral-integration/modules/RateLimiter';
import Storage from 'ringcentral-integration/modules/Storage';
import AccountExtension from 'ringcentral-integration/modules/AccountExtension';
import Subscription from 'ringcentral-integration/modules/Subscription';
import TabManager from 'ringcentral-integration/modules/TabManager';
import Contacts from 'ringcentral-integration/modules/Contacts';
import Auth from 'ringcentral-integration/modules/Auth';
import OAuth from 'ringcentral-widgets/modules/ProxyFrameOAuth';
import GlipCompany from 'ringcentral-integration/modules/GlipCompany';
import GlipPersons from 'ringcentral-integration/modules/GlipPersons';

import RouterInteraction from 'ringcentral-widgets/modules/RouterInteraction';

import Environment from '../Environment';

import GlipGroups from '../GlipGroups';
import GlipContacts from '../GlipContacts';
import GlipPosts from '../GlipPosts';

import Notification from '../../lib/notification';

// user Dependency Injection with decorator to create a phone class
// https://github.com/ringcentral/ringcentral-js-integration-commons/blob/master/docs/dependency-injection.md
@ModuleFactory({
  providers: [
    { provide: 'Alert', useClass: Alert },
    { provide: 'Brand', useClass: Brand },
    { provide: 'Locale', useClass: Locale },
    { provide: 'TabManager', useClass: TabManager },
    { provide: 'GlobalStorage', useClass: GlobalStorage },
    { provide: 'ConnectivityMonitor', useClass: ConnectivityMonitor },
    { provide: 'Auth', useClass: Auth },
    { provide: 'OAuth', useClass: OAuth },
    { provide: 'Storage', useClass: Storage },
    { provide: 'RateLimiter', useClass: RateLimiter },
    { provide: 'Subscription', useClass: Subscription },
    { provide: 'AccountExtension', useClass: AccountExtension },
    { provide: 'Contacts', useClass: Contacts },
    { provide: 'GlipContacts', useClass: GlipContacts },
    {
      provide: 'ContactSources',
      useFactory: ({ glipContacts }) =>
        [glipContacts],
      deps: ['GlipContacts']
    },
    { provide: 'DateTimeFormat', useClass: DateTimeFormat },
    { provide: 'RouterInteraction', useClass: RouterInteraction },
    { provide: 'Auth', useClass: Auth },
    { provide: 'Environment', useClass: Environment },
    { provide: 'GlipCompany', useClass: GlipCompany },
    { provide: 'GlipGroups', useClass: GlipGroups },
    { provide: 'GlipPosts', useClass: GlipPosts },
    { provide: 'GlipPersons', useClass: GlipPersons },
    {
      provide: 'EnvironmentOptions',
      useFactory: ({ sdkConfig }) => sdkConfig,
      deps: [
        { dep: 'SdkConfig' },
      ],
    },
    {
      provide: 'Client',
      useFactory: ({ sdkConfig }) =>
        new RingCentralClient(new SDK(sdkConfig)),
      deps: [
        { dep: 'SdkConfig', useParam: true, },
      ],
    },
  ]
})
export default class BasePhone extends RcModule {
  constructor(options) {
    super(options);
    const {
      appConfig,
    } = options;
    this._appConfig = appConfig;
    this._notification = new Notification();
  }

  initialize() {
    this.glipPosts.addNewPostListener((post) => {
      if (this.glipGroups.currentGroupId === post.groupId) {
        return;
      }
      const creator = this.glipPersons.personsMap[post.creatorId];
      this._notification.notify({
        title: creator && creator.firstName,
        text: post.text,
        icon: creator && creator.avatar,
        onClick: () => {
          this.glipGroups.updateCurrentGroupId(post.groupId);
        }
      });
    });
    this.store.subscribe(() => {
      if (this.auth.ready) {
        if (
          this.routerInteraction.currentPath !== '/' &&
          !this.auth.loggedIn
        ) {
          this.routerInteraction.push('/');
        } else if (
          (
            this.routerInteraction.currentPath === '/' ||
            this.routerInteraction.currentPath === '/glip'
          ) &&
          this.auth.loggedIn &&
          this.glipGroups.ready
        ) {
          if (this.glipGroups.currentGroupId) {
            this.routerInteraction.push(`/glip/groups/${this.glipGroups.currentGroupId}`);
            return;
          }
          this.routerInteraction.push('/glip/persons/me');
        }
      }
    });
  }

  get name() {
    return this._appConfig.name;
  }

  get version() {
    return this._appConfig.version;
  }

  get _actionTypes() {
    return null;
  }
}

export function createPhone({
  prefix,
  apiConfig,
  brandConfig,
  appVersion,
  redirectUri,
  stylesUri,
}) {
  @ModuleFactory({
    providers: [
      { provide: 'ModuleOptions', useValue: { prefix }, spread: true },
      {
        provide: 'SdkConfig',
        useValue: {
          ...apiConfig,
          cachePrefix: `sdk-${prefix}`,
          clearCacheOnRefreshError: false,
        },
      },
      {
        provide: 'AppConfig',
        useValue: { name: brandConfig.appName, version: appVersion },
      },
      { provide: 'BrandOptions', useValue: brandConfig, spread: true },
      { provide: 'OAuthOptions', useValue: { redirectUri }, spread: true },
      { provide: 'InteractionOptions', useValue: { stylesUri }, spread: true },
      {
        provide: 'WebphoneOptions',
        spread: true,
        useValue: {
          appKey: apiConfig.appKey,
          appName: brandConfig.appName,
          appVersion,
          webphoneLogLevel: 1,
        },
      },
    ]
  })
  class Phone extends BasePhone {}
  return Phone.create();
}
