// 문서함 양식. 문서는 HTML, 시트는 열과 행, 설문지는 질문 목록.
// 내용의 사실 수치는 넣지 않는다. 빈칸은 ○○○ 로 둔다.
import { V } from './docVars.js'

export const DOC_CATEGORIES = [
  { key: 'gongmun', label: '공문' },
  { key: 'report', label: '보고' },
  { key: 'record', label: '기록' }
]

const P = (s) => `<p>${s}</p>`

export const DOC_TEMPLATES = [
  {
    key: 'blank', title: '빈 문서', desc: '처음부터 쓰기', cat: 'report', preset: '보고서',
    html: P('내용을 적습니다.')
  },
  {
    key: 'request', title: '시설 협조 요청 공문', desc: '운영 중단 시설의 대체 시설 협조 요청', cat: 'gongmun', preset: '기안문', numbering: 'gian',
    head: { org: '동해시', to: '수신자 부서', via: '', title: '공공시설 기능 대체 협조 요청' },
    foot: { sender: '동해시장' },
    html: [
      P('1. 관련: 공공시설 기능연속성 관리 계획'),
      P('2. 아래 시설의 운영 중단으로 해당 역할을 대신할 시설의 협조를 요청합니다.'),
      P('가. 대상 시설: ○○○'),
      P('나. 중단 기능: ○○○'),
      P('다. 중단 기간: ○○○'),
      P('라. 대체 요청 시설: ○○○'),
      P('3. 협조 가능 여부를 회신하여 주시기 바랍니다.')
    ].join('')
  },
  {
    key: 'continuity', title: '기능연속성 조치 계획', desc: '중단 기간 동안의 기능 대체 계획', cat: 'report', preset: '계획서',
    html: [
      P('1. 추진 배경'),
      P('공공시설 한 곳이 여러 역할을 함께 맡고 있어 한 시설이 멈추면 여러 역할이 동시에 멈춥니다.'),
      P('2. 현황'),
      P(`등록 시설 ${V('facilities')}, 둘 이상 기능을 맡은 시설 ${V('multiRole')}, 운영 중단 시설 ${V('closed')}.`),
      P('3. 조치 계획'),
      P('가. 대체 시설 지정: ○○○'),
      P('나. 주민 안내 방법: ○○○'),
      P('다. 복귀 시점: ○○○')
    ].join('')
  },
  {
    key: 'situation', title: '시설 운영 상황 보고', desc: '역할별 운영과 중단 현황 보고', cat: 'report', preset: '보고서',
    html: [
      P(`기준 시각: ${V('today')}`),
      P(`등록 시설 ${V('facilities')} 가운데 운영 중 ${V('open')}, 중단 ${V('closed')}, 확인 필요 ${V('check')} 입니다.`),
      P('특이 사항: ○○○'),
      P('조치 사항: ○○○')
    ].join('')
  },
  {
    key: 'interview', title: '담당 부서 면담 기록', desc: '시설 운영 확인 면담 기록', cat: 'record', preset: '회의록',
    html: [
      P(`일시: ${V('today')}`),
      P('장소: ○○○'),
      P('참석: 부서명만 적습니다.'),
      P('확인 내용: ○○○'),
      P('후속 조치: ○○○')
    ].join('')
  }
]

export const SHEET_TEMPLATES = [
  { key: 'blank', title: '빈 시트', desc: '처음부터 쓰기', columns: [{ key: 'a', label: '열 1' }, { key: 'b', label: '열 2' }, { key: 'c', label: '열 3' }], rows: [['', '', ''], ['', '', ''], ['', '', '']] },
  {
    key: 'facilities', title: '시설 기능 대장', desc: '시설별 기능과 담당 부서',
    columns: [{ key: 'name', label: '시설' }, { key: 'role', label: '기능' }, { key: 'dept', label: '담당 부서' }, { key: 'status', label: '운영 상태' }, { key: 'memo', label: '메모' }],
    rows: [['', '', '', '', ''], ['', '', '', '', '']]
  },
  {
    key: 'closure', title: '운영 중단 일정표', desc: '공사와 점검으로 멈추는 기간',
    columns: [{ key: 'name', label: '시설' }, { key: 'cause', label: '사유' }, { key: 'start', label: '시작' }, { key: 'end', label: '종료' }, { key: 'alt', label: '대체 시설' }],
    rows: [['', '', '', '', '']]
  },
  {
    key: 'check', title: '현장 확인 기록', desc: '대장과 현장이 다른 항목 확인',
    columns: [{ key: 'name', label: '시설' }, { key: 'item', label: '확인 항목' }, { key: 'ledger', label: '대장 값' }, { key: 'field', label: '현장 값' }, { key: 'memo', label: '메모' }],
    rows: [['', '', '', '', '']]
  }
]

export const QUESTION_TYPES = [
  { value: 'short', label: '단답형' },
  { value: 'long', label: '장문형' },
  { value: 'choice', label: '객관식' },
  { value: 'check', label: '체크박스' },
  { value: 'scale', label: '선형 배율' },
  { value: 'date', label: '날짜' }
]

export const FORM_TEMPLATES = [
  { key: 'blank', title: '빈 설문지', desc: '처음부터 만들기', questions: [{ type: 'short', title: '질문', required: false }] },
  {
    key: 'facilityCheck', title: '시설 운영 확인', desc: '담당 부서에 묻는 운영 상태 확인',
    questions: [
      { type: 'short', title: '시설 이름', required: true },
      { type: 'choice', title: '지금 운영 상태', required: true, options: ['운영 중', '운영 중단', '확인 필요'] },
      { type: 'date', title: '중단 시작일', required: false },
      { type: 'date', title: '운영 재개 예정일', required: false },
      { type: 'long', title: '대체로 쓸 수 있는 시설', required: false }
    ]
  },
  {
    key: 'resident', title: '주민 이용 설문', desc: '시설을 찾을 때 겪는 어려움',
    questions: [
      { type: 'short', title: '사는 동', required: true },
      { type: 'check', title: '최근 한 해 동안 이용한 기능', required: false, options: ['쉼터', '대피', '임시주거', '급수', '응급', '체육', '돌봄', '행정'] },
      { type: 'scale', title: '시설이 문을 열었는지 알기 쉬웠다', required: true, min: 1, max: 5 },
      { type: 'long', title: '헛걸음한 경험', required: false }
    ]
  },
  {
    key: 'ut', title: '사용성 평가 사후 설문', desc: '과업 후 만족도와 의견',
    questions: [
      { type: 'short', title: '참여자 번호', required: true },
      { type: 'scale', title: '시설이 맡은 기능을 한눈에 알 수 있었다', required: true, min: 1, max: 5 },
      { type: 'scale', title: '운영 중단 기간을 찾기 쉬웠다', required: true, min: 1, max: 5 },
      { type: 'scale', title: '대체 시설을 고르기 쉬웠다', required: true, min: 1, max: 5 },
      { type: 'long', title: '가장 헷갈린 화면과 이유', required: false }
    ]
  },
  {
    key: 'consent', title: '면담 참여 동의', desc: '참여, 녹음, 인용 동의',
    questions: [
      { type: 'short', title: '소속', required: true },
      { type: 'choice', title: '면담 참여에 동의합니까?', required: true, options: ['동의', '동의하지 않음'] },
      { type: 'choice', title: '면담 녹음에 동의합니까?', required: true, options: ['동의', '동의하지 않음'] },
      { type: 'choice', title: '발언 익명 인용에 동의합니까?', required: true, options: ['동의', '동의하지 않음'] }
    ]
  }
]
