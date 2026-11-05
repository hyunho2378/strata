// 역할 거르기와 범례. '레이어' 버튼을 눌러 펼치는 팝오버 안에 들어간다.
// UI.md 8장 "기능 거르기 행" 규칙을 따른다. 테두리와 옆 막대를 쓰지 않고 왼쪽 지름 8px 점,
// 가운데 이름, 오른쪽 개수, 고른 상태는 면 색과 체크로만 알린다.
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { krds } from '../../tokens.js'

export default function RolePanel({ roles = [], colors = {}, selected = [], onToggle, onAll, counts = {}, scenes = [], onScene }) {
  const all = selected.length === 0
  return (
    <section aria-label="역할 거르기" className="flex min-h-0 w-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="type-h3 text-text-pri">역할</h2>
        <button
          type="button" onClick={onAll} aria-pressed={all}
          className={clsx('pressable h-8 rounded-sm px-3 type-caption', all ? 'bg-primary text-text-inverse' : 'bg-mute text-text-sec hover:bg-line-sub')}
        >
          전체
        </button>
      </div>
      <ul className="mt-2 flex flex-col gap-0.5">
        {roles.map((r) => {
          const on = all || selected.includes(r.id)
          return (
            <li key={r.id}>
              <button
                type="button" aria-pressed={on} onClick={() => onToggle(r.id)}
                className={clsx('pressable flex h-9 w-full items-center gap-2.5 rounded-sm px-2 text-left', on ? 'bg-primary-soft' : 'hover:bg-mute')}
              >
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-xs" style={{ backgroundColor: colors[r.id] || krds.gray[40] }} />
                <span className={clsx('min-w-0 flex-1 truncate type-body-sm', on ? 'text-primary-text' : 'text-text-sec')}>{r.label}</span>
                <span className={clsx('type-meta tabular-nums', on ? 'text-primary-text' : 'text-text-meta')}>{counts[r.id] ?? 0}</span>
                <Check size={16} aria-hidden="true" className={clsx('shrink-0 text-primary-text', !on && 'invisible')} />
              </button>
            </li>
          )
        })}
        {!roles.length && <li className="py-6 text-center type-body-sm text-text-meta">역할 자료를 아직 불러오지 못했어요.</li>}
      </ul>

      {scenes.length > 0 && (
        <div className="mt-4 shrink-0">
          <h2 className="type-h3 text-text-pri">대표 장면</h2>
          <ul className="mt-2 flex flex-col gap-0.5">
            {scenes.map((s) => (
              <li key={s.id || s.label}>
                <button
                  type="button" onClick={() => onScene?.(s)}
                  className="pressable flex h-9 w-full items-center rounded-sm px-2 text-left type-body-sm text-text-sec hover:bg-mute hover:text-text-pri"
                >
                  <span className="min-w-0 flex-1 truncate">{s.name || s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
