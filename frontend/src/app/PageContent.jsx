import React from 'react';

import Overview from '../features/dashboard/Overview';
import NetworkPage from '../features/network/Network';
import Relationships from '../features/relationships/Relationships';

import { Alerts } from '../features/alerts/Alerts';
import { Assets } from '../features/assets/Assets';
import { Events } from '../features/events/Events';
import { Incidents } from '../features/incidents/Incidents';
import { Mitre } from '../features/detection/Mitre';
import { Model } from '../features/detection/Model';
import { Rules } from '../features/detection/Rules';
import { Sources } from '../features/detection/Sources';
import { Threats } from '../features/detection/Threats';
import { Audit } from '../features/administration/Audit';
import { Reports } from '../features/administration/Reports';
import { Settings } from '../features/administration/Settings';
import { UsersPage } from '../features/administration/UsersPage';

export function PageContent({ page, common, tourActive, onSettingsDirtyChange }) {
  let content;
  switch (page) {
    case 'overview':
      content = <Overview {...common} />;
      break;
    case 'alerts':
      content = <Alerts {...common} />;
      break;
    case 'incidents':
      content = <Incidents {...common} />;
      break;
    case 'events':
      content = <Events {...common} />;
      break;
    case 'network':
      content = <NetworkPage {...common} />;
      break;
    case 'assets':
      content = <Assets {...common} />;
      break;
    case 'relationships':
      content = <Relationships {...common} tourActive={tourActive} />;
      break;
    case 'rules':
      content = <Rules {...common} />;
      break;
    case 'model':
      content = <Model {...common} />;
      break;
    case 'threats':
      content = <Threats {...common} />;
      break;
    case 'mitre':
      content = <Mitre {...common} />;
      break;
    case 'sources':
      content = <Sources {...common} />;
      break;
    case 'reports':
      content = <Reports {...common} />;
      break;
    case 'audit':
      content = <Audit {...common} />;
      break;
    case 'users':
      content = <UsersPage {...common} />;
      break;
    case 'settings':
      content = <Settings {...common} onDirtyChange={onSettingsDirtyChange} />;
      break;
    default:
      content = <Overview {...common} />;
  }

  return content;
}
