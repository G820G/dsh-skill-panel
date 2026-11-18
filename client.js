/**
 * Skill panel, browser half.
 *
 * Two surfaces, both read-only views of the shipped skill features:
 *
 * 1. A left-rail panel page (`sidebar.panellist` icon + the `main` panel keyed
 *    by the same id) that lists the skills the current session's agent
 *    composition exposes. The catalog is the `skills/list` Remote, so the list
 *    is exactly what `/` offers in that session; no skill data is computed
 *    here.
 * 2. A skill picker button in the composer tool row, right beside the shipped
 *    "+" control. It opens the shipped `/` menu restricted to the `skill`
 *    source through the input-trigger launcher, so a pick inserts the literal
 *    `/name ` through the ordinary source pipeline instead of a private
 *    insertion path.
 *
 * No Host half is needed: both surfaces call entry points that already exist.
 */
window.__ModuleLoader__.load({
  id: 'dsh-skill-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    /** Panel id: the sidebar entry and the `main` panel share this key. */
    const PANEL_ID = 'skill-panel'
    /** Locale namespace of this plugin's own copy. */
    const NS = 'skillPanel'
    /** Address grammar shared with the right Sidebar. */
    const FILE_ADDRESS_PREFIX = 'dsh-resource://file/session/'

    const EN = {
      'panel.title': 'Skills',
      'panel.subtitle': 'Skills this conversation can invoke as /name',
      'panel.filter': 'Filter skills',
      'panel.refresh': 'Refresh',
      'panel.loading': 'Loading skills…',
      'panel.refreshing': 'Refreshing…',
      'panel.failed': 'Skills could not be loaded',
      'panel.retry': 'Try again',
      'panel.noSession': 'No conversation is open',
      'panel.noSessionHint': 'Open or start a conversation to list the skills its agent can use.',
      'panel.empty': 'No skill matches this filter',
      'panel.emptyHint': 'Clear the filter to see every installed skill.',
      'panel.clearFilter': 'Clear filter',
      'panel.none': 'This composition exposes no skill',
      'panel.noneHint': 'Install a skill or enable a skill provider, then refresh.',
      'panel.start': 'Start a conversation',
      'panel.preview': 'Open SKILL.md in the right sidebar',
      'panel.userOnly': 'You only',
      'panel.unavailable': 'The skill catalog service is unavailable in this build',
      'composer.open': 'Choose a skill',
    }

    const ZH = {
      'panel.title': '技能',
      'panel.subtitle': '当前对话中可用 /名称 调用的技能',
      'panel.filter': '筛选技能',
      'panel.refresh': '刷新',
      'panel.loading': '正在加载技能…',
      'panel.refreshing': '正在刷新…',
      'panel.failed': '技能加载失败',
      'panel.retry': '重试',
      'panel.noSession': '还没有打开对话',
      'panel.noSessionHint': '打开或新建一个对话，即可查看该对话可用的技能。',
      'panel.empty': '没有匹配的技能',
      'panel.emptyHint': '清空筛选条件即可看到全部已安装技能。',
      'panel.clearFilter': '清空筛选',
      'panel.none': '当前会话没有可用的技能',
      'panel.noneHint': '安装技能或启用技能来源后点击刷新。',
      'panel.start': '新建对话',
      'panel.preview': '在右侧边栏打开 SKILL.md',
      'panel.userOnly': '仅你可用',
      'panel.unavailable': '当前构建未提供技能目录服务',
      'composer.open': '选择技能',
    }

    /** Component-encode one address segment, keeping `:` literal for drive letters. */
    function encodeSegment(segment) {
      return encodeURIComponent(segment).replace(/%3A/gi, ':')
    }

    /**
     * The `dsh-resource://file/session/…` address the right Sidebar opens.
     * @param sessionId - Session whose workspace resolves the path.
     * @param cwd - that Session's workspace root, when known.
     * @param path - absolute or workspace-relative SKILL.md path.
     * @returns the resource address.
     */
    function fileAddressFor(sessionId, cwd, path) {
      const normalized = String(path).replace(/\\/g, '/')
      const root = typeof cwd === 'string' ? cwd.replace(/\\/g, '/').replace(/\/+$/, '') : ''
      let relative = normalized
      if (root !== '') {
        if (normalized === root) relative = ''
        else if (normalized.startsWith(root + '/')) relative = normalized.slice(root.length + 1)
      }
      const encoded = relative.split('/').map(encodeSegment).join('/')
      return FILE_ADDRESS_PREFIX + encodeSegment(String(sessionId)) + '/' + encoded
    }

    /**
     * The session whose conversation the main column is showing: the one
     * retained by the main view, otherwise the first listed session.
     * @param state - sessions list snapshot from the slot's `useSessions` hook.
     * @returns the session id, or undefined when no session is listed.
     */
    function selectCurrentSession(state) {
      const byId = state && state.byId
      if (byId !== undefined && byId !== null) {
        const values = Object.values(byId)
        for (const summary of values) {
          const retained = summary && summary.retainedBy ? summary.retainedBy.mainView : undefined
          if (typeof retained === 'number' && retained > 0) return summary.id
        }
        const ids = state.ids
        if (Array.isArray(ids) && ids.length > 0) return ids[0]
      }
      return undefined
    }

    /** Four-point sparkle: the skill glyph shared by the rail icon and the picker. */
    function Sparkle(props) {
      const size = props && typeof props.size === 'number' ? props.size : 16
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block' },
        },
        h('path', {
          d: 'M8 1.4 9.55 6.45 14.6 8 9.55 9.55 8 14.6 6.45 9.55 1.4 8 6.45 6.45Z',
          fill: 'currentColor',
        }),
      )
    }

    /** Inspect glyph: opens the skill document in the right Sidebar. */
    function InspectGlyph() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': true, focusable: false, style: { display: 'block' } },
        h('path', {
          d: 'M1.6 8S4 3.6 8 3.6 14.4 8 14.4 8 12 12.4 8 12.4 1.6 8 1.6 8Z',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
        }),
        h('circle', { cx: 8, cy: 8, r: 1.9, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
      )
    }

    /** Refresh glyph. */
    function RefreshGlyph() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': true, focusable: false, style: { display: 'block' } },
        h('path', {
          d: 'M13.1 8a5.1 5.1 0 1 1-1.55-3.66',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
        h('path', { d: 'M13.2 2.4v3.1h-3.1', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
    }

    const CSS = `
.dsp-page,
.dsp-page *,
.dsp-trigger {
  box-sizing: border-box;
}
.dsp-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font-size: 14px;
  line-height: 1.6;
}
.dsp-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  /* The host's 9px rail with its 5px thumb inset 2px from the pane edge. */
  --dsh-scrollbar-width: 9px;
  --dsh-scrollbar-thumb-border: 2px;
}
.dsp-content {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 clamp(24px, 4vw, 48px) 48px;
}
@media (max-width: 767px) {
  .dsp-content { padding-inline: 20px; }
}
.dsp-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 28px;
  margin-bottom: 4px;
}
/* macOS hiddenInset titlebar: match the host pages' frame clearance above the heading. */
[data-platform='darwin'] .dsp-heading {
  padding-top: calc(28px + var(--dsh-frame-top-clearance, 0px));
}
.dsp-headingMain {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.dsp-title {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
  letter-spacing: 0;
}
.dsp-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.dsp-headingActions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsp-subtitle {
  margin: 0 0 18px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}
.dsp-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.dsp-search {
  flex: 1;
  min-width: 180px;
  height: 36px;
  padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
}
.dsp-search::placeholder { color: var(--dsw-alias-label-secondary); }
.dsp-search:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsp-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.dsp-button:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.dsp-button:disabled { opacity: 0.55; cursor: default; }
.dsp-button:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsp-status {
  margin: 0 0 10px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px;
}
.dsp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dsp-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 13px 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.dsp-rowMain { flex: 1; min-width: 0; }
.dsp-rowTitle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}
.dsp-glyph {
  display: inline-flex;
  flex: none;
  color: var(--dsw-alias-brand-primary);
}
.dsp-name {
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.dsp-badge {
  display: inline-flex;
  align-items: center;
  height: 19px;
  padding: 0 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}
.dsp-badge[data-tone='user'] {
  border-color: var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
}
.dsp-desc {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.dsp-when {
  margin: 6px 0 0;
  padding-left: 10px;
  border-left: 2px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px;
  overflow-wrap: anywhere;
}
.dsp-rowAction {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsp-rowAction:hover {
  border-color: var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.dsp-rowAction:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsp-notice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 20px 16px;
  border: 1px dashed var(--dsw-alias-border-l1);
  border-radius: 12px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}
.dsp-notice[data-tone='error'] {
  border-style: solid;
  border-color: var(--dsw-alias-state-error-primary);
  color: var(--dsw-alias-label-primary);
}
.dsp-noticeTitle {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 13.5px;
  font-weight: 600;
}
.dsp-noticeText { margin: 0; overflow-wrap: anywhere; }
.dsp-trigger {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 999px;
  corner-shape: round;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsp-trigger:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
}
.dsp-trigger:disabled {
  opacity: 0.5;
  cursor: default;
}
.dsp-trigger[aria-expanded='true'] {
  color: var(--dsw-alias-brand-primary);
}
.dsp-trigger:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
`

    /**
     * Browser plugin body: register copy, styles, the panel page, its rail
     * entry, and the composer picker.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      /**
       * Resolve one Client service on use. This module may load before the
       * Remote assembly mounts, so nothing is captured at load time.
       * @param name - service key.
       * @returns the service, or undefined when this build has none.
       */
      const serviceAt = (name) => {
        try {
          const service = ctx.get(name)
          return service === null ? undefined : service
        } catch (error) {
          console.error('[skill-panel] service lookup failed:', name, error)
          return undefined
        }
      }

      ctx.effect(() => {
        const locale = serviceAt('locale')
        const disposers = []
        if (locale && typeof locale.register === 'function') {
          try {
            disposers.push(locale.register(NS, 'en', EN))
            disposers.push(locale.register(NS, 'zh', ZH))
          } catch (error) {
            console.error('[skill-panel] dictionary registration failed:', error)
          }
        }
        return () => {
          for (const dispose of disposers.reverse()) {
            try {
              if (typeof dispose === 'function') dispose()
            } catch (error) {
              console.error('[skill-panel] dictionary disposal failed:', error)
            }
          }
        }
      }, 'skill-panel: dictionaries')

      /**
       * Read the active locale id without assuming one snapshot shape.
       * @returns a lowercased locale id, or '' when it cannot be read.
       */
      const localeId = () => {
        try {
          const locale = serviceAt('locale')
          if (locale && typeof locale.getLocale === 'function') {
            const snapshot = locale.getLocale()
            const id = snapshot && (snapshot.id ?? snapshot.locale ?? snapshot.language)
            if (typeof id === 'string' && id !== '') return id.toLowerCase()
          }
        } catch (error) {
          console.error('[skill-panel] locale read failed:', error)
        }
        const documentLang = typeof document !== 'undefined' ? document.documentElement.lang : ''
        if (typeof documentLang === 'string' && documentLang !== '') return documentLang.toLowerCase()
        const navigatorLang = typeof navigator !== 'undefined' && typeof navigator.language === 'string' ? navigator.language : ''
        return navigatorLang.toLowerCase()
      }

      /**
       * Translate one own-namespace key.
       * @param key - dictionary key.
       * @returns the active-locale string, the English string, or the key.
       */
      const t = (key) => {
        const dictionary = localeId().startsWith('zh') ? ZH : EN
        if (typeof dictionary[key] === 'string') return dictionary[key]
        if (typeof EN[key] === 'string') return EN[key]
        return key
      }

      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-dsh-skill-panel', '')
        style.textContent = CSS
        document.head.appendChild(style)
        return () => { style.remove() }
      }, 'skill-panel: styles')

      /**
       * The `remote.skills` namespace, read once while this plugin's own
       * context is the caller: the Remote gateway authorises the property only
       * for a context that declares the namespace in `inject`, and reading it
       * later from a render callback would not carry that context. The shipped
       * skill UI captures the namespace at the same point for the same reason.
       * @returns the namespace, or undefined when this build serves none.
       */
      let skillCatalog
      const skillsNamespace = () => {
        if (skillCatalog !== undefined && skillCatalog !== null) return skillCatalog
        // The nested service key first — the direct, already-authorized handle —
        // then the namespace property on the remote carrier. `inject`
        // authorises both, and either may be the one this build exposes.
        try {
          const direct = serviceAt('remote.skills')
          if (direct !== undefined && direct !== null) {
            skillCatalog = direct
            return skillCatalog
          }
        } catch (error) {
          console.error('[skill-panel] remote.skills service lookup failed:', error)
        }
        try {
          const remoteApi = serviceAt('remote')
          skillCatalog = remoteApi === undefined || remoteApi === null ? undefined : remoteApi.skills
        } catch (error) {
          console.error('[skill-panel] remote.skills is not authorized:', error)
          skillCatalog = undefined
        }
        return skillCatalog
      }
      // Eager first read: resolve (and log) the namespace while `apply` still
      // runs on this plugin's context, before any surface needs it.
      skillsNamespace()

      /**
       * Fetch the session's installed skill catalog through the shipped Remote.
       * @param sessionId - the session whose composition is read.
       * @param signal - cancels the call.
       * @returns the sorted catalog entries.
       */
      const loadSkills = async (sessionId, signal) => {
        const skillsRemote = skillsNamespace()
        if (skillsRemote === undefined || skillsRemote === null || typeof skillsRemote.list !== 'function') {
          throw new Error(t('panel.unavailable'))
        }
        const result = await skillsRemote.list({ sessionId }, signal)
        if (result === undefined || result === null) throw new Error(t('panel.failed'))
        if (result.ok !== true) {
          const failure = result.error
          const message = failure && typeof failure.message === 'string' ? failure.message : ''
          throw new Error(message !== '' ? message : t('panel.failed'))
        }
        const entries = result.value && Array.isArray(result.value.skills) ? result.value.skills : []
        return entries.slice().sort((left, right) => String(left.name).localeCompare(String(right.name)))
      }

      /** The panel page: the installed skill list of the current session. */
      const SkillPanelPage = (props) => {
        const sessionId = props.useSessions(selectCurrentSession)
        const [state, setState] = useState({ status: 'loading', items: [], message: '' })
        const [query, setQuery] = useState('')
        const [revision, setRevision] = useState(0)
        const runId = useRef(0)

        useEffect(() => {
          const mine = ++runId.current
          if (sessionId === undefined) {
            setState({ status: 'no-session', items: [], message: '' })
            return undefined
          }
          const controller = new AbortController()
          let cancelled = false
          setState((previous) => (
            previous.items.length > 0
              ? { status: 'refreshing', items: previous.items, message: '' }
              : { status: 'loading', items: [], message: '' }
          ))
          loadSkills(sessionId, controller.signal).then(
            (items) => {
              if (cancelled || runId.current !== mine) return
              setState({ status: 'ready', items, message: '' })
            },
            (error) => {
              if (cancelled || runId.current !== mine) return
              const message = error && typeof error.message === 'string' ? error.message : ''
              setState({
                status: 'error',
                items: [],
                message: message !== '' ? message : t('panel.failed'),
              })
            },
          )
          return () => {
            cancelled = true
            controller.abort()
          }
        }, [sessionId, revision])

        const filtered = useMemo(() => {
          const needle = query.trim().toLowerCase()
          if (needle === '') return state.items
          return state.items.filter((entry) => {
            const name = String(entry.name || '').toLowerCase()
            const description = String(entry.description || '').toLowerCase()
            const whenToUse = String(entry.whenToUse || '').toLowerCase()
            return name.includes(needle) || description.includes(needle) || whenToUse.includes(needle)
          })
        }, [state.items, query])

        const preview = useCallback((entry) => {
          const path = entry && typeof entry.path === 'string' ? entry.path : ''
          if (path === '' || sessionId === undefined) return
          const rightbar = serviceAt('sidebarRight')
          if (rightbar === undefined || rightbar === null || typeof rightbar.openResource !== 'function') return
          let cwd
          try {
            const sessionsService = serviceAt('sessions')
            const snapshot = sessionsService === undefined ? undefined : sessionsService.list.getSnapshot()
            const summary = snapshot && snapshot.byId ? snapshot.byId[sessionId] : undefined
            cwd = summary ? summary.cwd : undefined
          } catch (error) {
            console.error('[skill-panel] reading the session cwd failed:', error)
          }
          try {
            rightbar.openResource(fileAddressFor(sessionId, cwd, path))
          } catch (error) {
            console.error('[skill-panel] opening the skill document failed:', error)
          }
        }, [sessionId])

        const busy = state.status === 'loading' || state.status === 'refreshing'

        return h(
          'section',
          { className: 'dsp-page', 'data-dsp-panel': '' },
          h(
            'div',
            { className: 'dsp-scroll' },
            h(
              'div',
              { className: 'dsp-content' },
              h(
                'header',
                { className: 'dsp-heading' },
                h(
                  'div',
                  { className: 'dsp-headingMain' },
                  h('h1', { className: 'dsp-title' }, t('panel.title')),
                  // The count describes a settled catalog only: a zero beside a
                  // failure or an unopened session would read as "no skills".
                  state.status === 'ready' || state.status === 'refreshing'
                    ? h('span', { className: 'dsp-count', 'aria-hidden': true }, String(filtered.length))
                    : null,
                ),
                h(
                  'div',
                  { className: 'dsp-headingActions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsp-button',
                      disabled: busy || sessionId === undefined,
                      onClick: () => { setRevision((value) => value + 1) },
                    },
                    h(RefreshGlyph, null),
                    t('panel.refresh'),
                  ),
                ),
              ),
              h('p', { className: 'dsp-subtitle' }, t('panel.subtitle')),
              h(
                'div',
                { className: 'dsp-toolbar' },
                h('input', {
                  type: 'search',
                  className: 'dsp-search',
                  value: query,
                  placeholder: t('panel.filter'),
                  'aria-label': t('panel.filter'),
                  onChange: (event) => { setQuery(event.target.value) },
                }),
              ),
              state.status === 'refreshing'
                ? h('p', { className: 'dsp-status', role: 'status' }, t('panel.refreshing'))
                : null,
              h(PanelBody, {
                state,
                filtered,
                query,
                onRetry: () => { setRevision((value) => value + 1) },
                onClearFilter: () => { setQuery('') },
                onStart: () => {
                  const workspace = serviceAt('uiWorkspace')
                  if (workspace === undefined || typeof workspace.startSession !== 'function') return
                  try {
                    workspace.startSession()
                  } catch (error) {
                    console.error('[skill-panel] starting a conversation failed:', error)
                  }
                },
                onPreview: preview,
              }),
            ),
          ),
        )
      }

      /** The panel's body for one load state. */
      const PanelBody = (props) => {
        const { state, filtered } = props
        if (state.status === 'loading') {
          return h('div', { className: 'dsp-notice', role: 'status' }, t('panel.loading'))
        }
        if (state.status === 'error') {
          return h(
            'div',
            { className: 'dsp-notice', 'data-tone': 'error', role: 'alert' },
            h('p', { className: 'dsp-noticeTitle' }, t('panel.failed')),
            h('p', { className: 'dsp-noticeText' }, state.message),
            h(
              'button',
              { type: 'button', className: 'dsp-button', onClick: props.onRetry },
              t('panel.retry'),
            ),
          )
        }
        if (state.status === 'no-session') {
          return h(
            'div',
            { className: 'dsp-notice' },
            h('p', { className: 'dsp-noticeTitle' }, t('panel.noSession')),
            h('p', { className: 'dsp-noticeText' }, t('panel.noSessionHint')),
            h(
              'button',
              { type: 'button', className: 'dsp-button', onClick: props.onStart },
              t('panel.start'),
            ),
          )
        }
        if (state.items.length === 0) {
          return h(
            'div',
            { className: 'dsp-notice' },
            h('p', { className: 'dsp-noticeTitle' }, t('panel.none')),
            h('p', { className: 'dsp-noticeText' }, t('panel.noneHint')),
            h(
              'button',
              { type: 'button', className: 'dsp-button', onClick: props.onRetry },
              t('panel.refresh'),
            ),
          )
        }
        if (filtered.length === 0) {
          return h(
            'div',
            { className: 'dsp-notice' },
            h('p', { className: 'dsp-noticeTitle' }, t('panel.empty')),
            h('p', { className: 'dsp-noticeText' }, t('panel.emptyHint')),
            h(
              'button',
              { type: 'button', className: 'dsp-button', onClick: props.onClearFilter },
              t('panel.clearFilter'),
            ),
          )
        }
        return h(
          'ul',
          { className: 'dsp-list', 'aria-busy': state.status === 'refreshing', 'aria-label': t('panel.title') },
          filtered.map((entry) => {
            const name = String(entry.name || '')
            const modelInvocable = entry.modelInvocable === true
            const path = typeof entry.path === 'string' ? entry.path : ''
            return h(
              'li',
              { key: name, className: 'dsp-row' },
              h(
                'div',
                { className: 'dsp-rowMain' },
                h(
                  'div',
                  { className: 'dsp-rowTitle' },
                  h('span', { className: 'dsp-glyph' }, h(Sparkle, { size: 13 })),
                  h('span', { className: 'dsp-name' }, '/' + name),
                  // The exception, not the rule: a skill the agent cannot
                  // invoke on its own is reachable only through this list.
                  modelInvocable
                    ? null
                    : h(
                      'span',
                      { className: 'dsp-badge', 'data-tone': 'user' },
                      t('panel.userOnly'),
                    ),
                ),
                entry.description ? h('p', { className: 'dsp-desc' }, String(entry.description)) : null,
                entry.whenToUse ? h('p', { className: 'dsp-when' }, String(entry.whenToUse)) : null,
              ),
              path === ''
                ? null
                : h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsp-rowAction',
                    title: t('panel.preview'),
                    'aria-label': t('panel.preview'),
                    onMouseDown: (event) => { event.preventDefault() },
                    onClick: () => { props.onPreview(entry) },
                  },
                  h(InspectGlyph, null),
                ),
            )
          }),
        )
      }

      /**
       * Resolve one session's input-trigger controller.
       * @param sessionId - the composer's session.
       * @returns the controller, or undefined without a retained session.
       */
      const controllerForSession = (sessionId) => {
        const inputTriggers = serviceAt('inputTriggers')
        const sessionsService = serviceAt('sessions')
        if (inputTriggers === undefined || inputTriggers === null) return undefined
        if (sessionsService === undefined || sessionsService === null) return undefined
        const binding = sessionsService.binding(sessionId)
        if (binding === undefined || binding === null || binding.ctx === undefined) return undefined
        return inputTriggers.sessionOf(binding.ctx)
      }

      /**
       * Toggle the shipped `/` menu restricted to the `skill` source, so a pick
       * inserts `/name ` through the ordinary source pipeline.
       * @param sessionId - the composer's session.
       * @param span - the span the pick must use; the source pipeline applies the insert there.
       * @returns whether a `skill` list is now open.
       */
      const launchSkillMenu = (sessionId, span) => {
        const controller = controllerForSession(sessionId)
        if (controller === undefined || controller === null || typeof controller.toggleSource !== 'function') return false
        controller.toggleSource('skill', {
          trigger: '/',
          query: '',
          quoted: false,
          // The host only loads a skill from a leading /name token, so the pick
          // always lands at the start of the message.
          position: 'leading',
          span,
        })
        const menu = controller.menu
        if (menu === undefined || menu === null || typeof menu.getSnapshot !== 'function') return true
        const state = menu.getSnapshot()
        // toggleSource dismisses when no source owns that name: report the real
        // outcome so the caller can fall back instead of going dead.
        return state.open === true && Array.isArray(state.groups) && state.groups.some((group) => group.source === 'skill')
      }

      /** The composer picker: one compact control beside the shipped plus button. */
      const SkillTrigger = (props) => {
        const phase = props.useInput((state) => state.phase)
        const [expanded, setExpanded] = useState(false)

        // Reflect the group's own open state, so the control reads as a toggle.
        useEffect(() => {
          const controller = controllerForSession(props.sessionId)
          const store = controller === undefined ? undefined : controller.launcher
          if (store === undefined || store === null) return undefined
          if (typeof store.getSnapshot !== 'function' || typeof store.subscribe !== 'function') return undefined
          const read = () => {
            try {
              setExpanded(store.getSnapshot() === 'skill')
            } catch (error) {
              console.error('[skill-panel] reading the menu state failed:', error)
            }
          }
          read()
          const off = store.subscribe(read)
          return () => {
            if (typeof off === 'function') off()
          }
        }, [props.sessionId])

        const open = useCallback((event) => {
          // A keyboard activation leaves focus on this button, and the menu is
          // driven from the editor: hand the caret back to this composer card.
          if (event && event.detail === 0 && event.currentTarget) {
            try {
              const card = event.currentTarget.closest('[data-composer-card]')
              const editor = card === null ? null : card.querySelector('[contenteditable="true"]')
              if (editor !== null && typeof editor.focus === 'function') editor.focus()
            } catch (error) {
              console.error('[skill-panel] restoring composer focus failed:', error)
            }
          }
          let captured
          try {
            captured = props.inputActions.captureInsertion()
          } catch (error) {
            console.error('[skill-panel] capturing the caret failed:', error)
            return
          }
          const span = { start: 0, end: 0, draftRev: captured.draftRev }
          let opened = false
          try {
            opened = launchSkillMenu(props.sessionId, span)
          } catch (error) {
            console.error('[skill-panel] opening the skill menu failed:', error)
          }
          // A second click toggles the open list closed; it must not insert.
          if (expanded || opened) return
          // No skill source in this build: land the trigger character so the
          // composer's own `/` menu still opens from the start of the draft.
          try {
            props.inputActions.insertText('/', span)
          } catch (error) {
            console.error('[skill-panel] inserting the trigger character failed:', error)
          }
        }, [expanded, props.inputActions, props.sessionId])

        const locked = phase !== undefined && phase !== 'plain'

        return h(
          'button',
          {
            type: 'button',
            className: 'dsp-trigger',
            title: t('composer.open'),
            'aria-label': t('composer.open'),
            'aria-haspopup': 'listbox',
            'aria-expanded': expanded,
            disabled: locked,
            onMouseDown: (event) => { event.preventDefault() },
            onClick: open,
          },
          h(Sparkle, { size: 15 }),
        )
      }

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
      }, SkillPanelPage))

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 21,
        locale: NS,
        label: () => t('panel.title'),
      }, function SkillPanelIcon(props) {
        return h(Sparkle, { size: props && typeof props.size === 'number' ? props.size : 20 })
      }))

      ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
        name: 'conversation.input.left',
        id: 'skill-panel',
        order: 20,
        locale: NS,
      }, SkillTrigger))
    }

    // `remote.skills` is a guarded Client Remote namespace: the gateway refuses
    // the property unless this plugin declares it (and its carrier `remote`) as
    // an injected dependency, exactly as the shipped skill UI does.
    return { inject: ['slots', 'remote', 'remote.skills'], apply }
  },
})
