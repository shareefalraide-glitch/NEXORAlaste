import React from 'react';

import { Drawer, InfoBox } from '../../../shared/ui/index';
import { events } from '../../../data/fixtures/demo-records';

import InvestigationTabs from '../workspace/InvestigationTabs';

import EntityContext from './EntityContext';

import { detailTypes, InvestigationTrail } from './DetailComponents';
import { IncidentDetails } from './IncidentDetails';
import { AlertDetails } from './AlertDetails';
import { EventDetails } from './EventDetails';
import { AssetDetails } from './AssetDetails';
import { SourceDetails } from './SourceDetails';
import { RuleDetails } from './RuleDetails';
import { AuditDetails } from './AuditDetails';
export default function Details({
  selection,
  history,
  onBack,
  onJump,
  data,
  onClose,
  openModal,
  openDetail,
  update,
  offlineSimulation = false,
  investigations = {},
  setInvestigations,
  triageRecords = {},
  submitTriage,
  timeRange = '24h',
  workspaceTabs,
  sessionRef,
  tourExample = false,
  embedded = false,
}) {
  if (!selection) return null;
  const { kind, id } = selection;
  // Tour uses a fresh view; real drafts remain in page memory only.
  const viewSessionRef = tourExample ? null : sessionRef;
  const scrollKey = `${workspaceTabs?.state.activeId || 'ordinary'}:${selection.key}`;
  const workspaceControl =
    !embedded && workspaceTabs?.state.activeId ? (
      <InvestigationTabs
        workspace={workspaceTabs.state}
        incidents={data.incidents}
        {...workspaceTabs}
      />
    ) : null;
  const type = detailTypes[kind] || 'سجل';
  const trail = <InvestigationTrail history={history} onBack={onBack} onJump={onJump} />;
  if (kind === 'entity') {
    const title = `سياق ${id.split('|').slice(1).join('|')}`;
    const content = (
      <>
        {trail}
        <EntityContext id={id} data={data} openDetail={openDetail} timeRange={timeRange} />
      </>
    );
    if (embedded)
      return (
        <div className="split-detail">
          <h3 className="split-detail-heading" tabIndex={-1}>
            {title}
          </h3>
          {content}
        </div>
      );
    return (
      <Drawer
        workspaceControl={workspaceControl}
        scrollMemory={sessionRef}
        scrollKey={scrollKey}
        title={title}
        subtitle="بيانات تجريبية للعرض فقط"
        onClose={onClose}
      >
        {content}
      </Drawer>
    );
  }
  const coll =
    kind === 'incident'
      ? data.incidents
      : kind === 'alert'
        ? data.alerts
        : kind === 'event'
          ? events
          : kind === 'asset'
            ? data.assets
            : kind === 'source'
              ? data.sources
              : kind === 'rule'
                ? data.rules
                : kind === 'audit'
                  ? data.audit
                  : [];
  const item = coll.find(x => x.id === id);
  if (!item) return <InfoBox>السجل غير متاح في العينة الحالية.</InfoBox>;
  const title = `${type} ${id}`;
  const content = (
    <>
      {trail}
      {kind === 'incident' && (
        <IncidentDetails
          item={item}
          data={data}
          openModal={openModal}
          openDetail={openDetail}
          offlineSimulation={offlineSimulation}
          investigations={investigations}
          setInvestigations={setInvestigations}
          triageRecords={triageRecords}
          timeRange={timeRange}
          sessionRef={sessionRef}
          viewSessionRef={viewSessionRef}
        />
      )}
      {kind === 'alert' && (
        <AlertDetails
          item={item}
          data={data}
          openModal={openModal}
          openDetail={openDetail}
          update={update}
          offlineSimulation={offlineSimulation}
          triageRecords={triageRecords}
          submitTriage={submitTriage}
          sessionRef={sessionRef}
          workspaceId={workspaceTabs?.state.activeId}
        />
      )}
      {kind === 'event' && <EventDetails item={item} data={data} openDetail={openDetail} />}
      {kind === 'source' && (
        <SourceDetails
          item={item}
          data={data}
          openDetail={openDetail}
          openModal={openModal}
          offlineSimulation={offlineSimulation}
        />
      )}
      {kind === 'asset' && (
        <AssetDetails
          item={item}
          data={data}
          openModal={openModal}
          openDetail={openDetail}
          update={update}
          offlineSimulation={offlineSimulation}
          sessionRef={viewSessionRef}
          viewScope={workspaceTabs?.state.activeId || 'ordinary'}
        />
      )}
      {kind === 'rule' && <RuleDetails item={item} openModal={openModal} update={update} />}
      {kind === 'audit' && <AuditDetails item={item} />}
    </>
  );
  if (embedded)
    return (
      <div className="split-detail">
        <h3 className="split-detail-heading" tabIndex={-1}>
          {title}
        </h3>
        {content}
      </div>
    );
  return (
    <Drawer
      workspaceControl={workspaceControl}
      scrollMemory={sessionRef}
      scrollKey={scrollKey}
      title={title}
      subtitle="بيانات تجريبية للعرض فقط"
      onClose={onClose}
      wide={kind === 'incident'}
    >
      {content}
    </Drawer>
  );
}
