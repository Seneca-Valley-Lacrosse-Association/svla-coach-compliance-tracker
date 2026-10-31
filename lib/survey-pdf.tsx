import 'server-only'
import path from 'node:path'
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { buildReport, parseSummary, type SurveyReport } from './survey-report'
import { longDate, shortDate, todayET, type SurveyAssignment, type SurveyCycle } from './surveys'

const fonts = path.join(process.cwd(), 'public', 'fonts')
let registered = false
function registerFonts() {
  if (registered) return
  Font.register({ family: 'Lato', fonts: [
    { src: path.join(fonts, 'lato-latin-400-normal.woff') },
    { src: path.join(fonts, 'lato-latin-400-italic.woff'), fontStyle: 'italic' },
    { src: path.join(fonts, 'lato-latin-700-normal.woff'), fontWeight: 700 },
  ] })
  Font.register({ family: 'NotoSerif', fonts: [{ src: path.join(fonts, 'noto-serif-latin-700-normal.woff'), fontWeight: 700 }] })
  // No automatic hyphenation; only break very long unbroken strings such as email addresses.
  Font.registerHyphenationCallback((word) => word.length > 22 ? word.match(/.{1,18}/g) ?? [word] : [word])
  registered = true
}

const NAVY = '#13294b'
const BLUE = '#3f7fc0'
const GREY = '#5b6573'
const RULE = '#cfd6df'
const ZEBRA = '#f2f4f7'

const s = StyleSheet.create({
  page: { fontFamily: 'Lato', fontSize: 10, lineHeight: 1.4, color: '#1d232b', paddingTop: 50, paddingBottom: 56, paddingHorizontal: 54 },
  landscape: { paddingHorizontal: 36 },
  footer: { position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: GREY },
  org: { color: BLUE, fontWeight: 700, fontSize: 10, letterSpacing: 0.3 },
  title: { fontFamily: 'NotoSerif', fontWeight: 700, fontSize: 24, color: NAVY, marginTop: 2, lineHeight: 1.2 },
  sub: { color: GREY, fontSize: 10, marginTop: 6 },
  note: { color: GREY, fontStyle: 'italic', fontSize: 9.5, marginTop: 8 },
  h2: { fontFamily: 'NotoSerif', fontWeight: 700, fontSize: 16, color: NAVY, marginTop: 20, marginBottom: 8 },
  h3: { fontFamily: 'NotoSerif', fontWeight: 700, fontSize: 13, color: NAVY, marginTop: 14 },
  meta: { color: BLUE, fontWeight: 700, fontSize: 9.5, marginTop: 3, marginBottom: 6 },
  intro: { color: GREY, fontSize: 9.5, marginBottom: 8 },
  table: {},
  headRow: { flexDirection: 'row', backgroundColor: NAVY },
  headCell: { color: '#ffffff', fontWeight: 700, fontSize: 9.5, paddingVertical: 5, paddingHorizontal: 6 },
  row: { flexDirection: 'row', borderBottomWidth: 0.75, borderLeftWidth: 0.75, borderRightWidth: 0.75, borderColor: RULE },
  cell: { paddingVertical: 5, paddingHorizontal: 6, fontSize: 9.5 },
  bold: { fontWeight: 700 },
  bulletRow: { flexDirection: 'row', marginBottom: 5, paddingLeft: 10 },
  bulletDot: { width: 12 },
  para: { marginBottom: 6 },
  muted: { color: GREY },
})

function Table({ columns, rows, boldFirst = true, repeatHeader = false }: { columns: { title: string; width: string }[]; rows: string[][]; boldFirst?: boolean; repeatHeader?: boolean }) {
  return (
    <View style={s.table}>
      <View style={s.headRow} fixed={repeatHeader} minPresenceAhead={40}>
        {columns.map((c) => <Text key={c.title} style={[s.headCell, { width: c.width }]}>{c.title}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[s.row, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]} wrap={false}>
          {r.map((cell, j) => <Text key={j} style={[s.cell, { width: columns[j].width }, j === 0 && boldFirst ? s.bold : {}]}>{cell}</Text>)}
        </View>
      ))}
    </View>
  )
}

function Summary({ text }: { text: string }) {
  return (
    <View>
      {parseSummary(text).map((b, i) => {
        const body = <Text>{b.parts.map((p, j) => <Text key={j} style={p.bold ? s.bold : {}}>{p.text}</Text>)}</Text>
        return b.type === 'bullet'
          ? <View key={i} style={s.bulletRow} wrap={false}><Text style={s.bulletDot}>•</Text><View style={{ flex: 1 }}>{body}</View></View>
          : <View key={i} style={s.para}>{body}</View>
      })}
    </View>
  )
}

function Footer({ cycle }: { cycle: SurveyCycle }) {
  return <Text style={s.footer} fixed render={({ pageNumber }) => `SVLA ${cycle.seasonLabel} Coaching Survey Summary · Internal · Page ${pageNumber}`} />
}

function ReportDocument({ report }: { report: SurveyReport }) {
  const { cycle } = report
  const window = report.firstSubmitted ? `received ${shortDate(report.firstSubmitted)} – ${shortDate(report.lastSubmitted)}` : 'received so far'
  return (
    <Document title={`SVLA ${cycle.seasonLabel} Coaching Survey Summary`} author="Seneca Valley Lacrosse Association" creator="SVLA Compliance Tracker">
      <Page size="LETTER" style={s.page}>
        <Text style={s.org}>SENECA VALLEY LACROSSE ASSOCIATION</Text>
        <Text style={s.title}>{cycle.seasonLabel} Coaching Survey Summary</Text>
        <Text style={s.sub}>Coach feedback and {cycle.nextSeasonLabel} intentions · {report.responded.length} submission{report.responded.length === 1 ? '' : 's'} {window} · Prepared {longDate(todayET()).replace(/^\w+, /, '')}</Text>
        <Text style={s.note}>Internal document for the SVLA Board and age-group coordinators. It contains coach contact details and candid feedback; please keep it within the file share&apos;s restricted folder.</Text>

        <Text style={s.h2}>At a Glance</Text>
        <Table columns={[{ title: 'Measure', width: '42%' }, { title: 'Result', width: '58%' }]} rows={report.glance.map((g) => [g.label, g.value])} />

        {cycle.summaryThemes.trim() && <><Text style={s.h2} minPresenceAhead={60}>What Coaches Told Us</Text><Summary text={cycle.summaryThemes} /></>}
        {cycle.summaryFollowUp.trim() && <><Text style={s.h2} minPresenceAhead={60}>Items for Follow-Up</Text><Summary text={cycle.summaryFollowUp} /></>}
        <Footer cycle={cycle} />
      </Page>

      {report.roster.length > 0 && (
        <Page size="LETTER" orientation="landscape" style={[s.page, s.landscape]}>
          <Text style={[s.h2, { marginTop: 0 }]}>Coach Roster and {cycle.nextSeasonLabel} Intentions</Text>
          <Text style={s.intro}>Youth coaches first, then high school. &ldquo;Years&rdquo; is total years of lacrosse coaching experience as reported.</Text>
          <Table
            columns={[{ title: 'Coach', width: '12%' }, { title: `${cycle.seasonLabel} team(s)`, width: '14%' }, { title: cycle.nextSeasonLabel, width: '10%' }, { title: 'Fall Ball', width: '6%' }, { title: 'Years', width: '6%' }, { title: 'USAL cert', width: '9%' }, { title: 'Email', width: '19%' }, { title: 'Notes', width: '24%' }]}
            rows={report.roster.map((r) => [r.name, r.team, r.returning, r.fallBall, r.years, r.certification, r.email, r.notes])}
            repeatHeader
          />
          {report.outstanding.length > 0 && !cycle.isHistorical && (
            <View wrap={false}>
              <Text style={s.h3}>Not yet responded ({report.outstanding.length})</Text>
              <Text style={{ marginTop: 4 }}>{report.outstanding.map((a) => `${a.coachName} (${a.team})`).join(' · ')}</Text>
            </View>
          )}
          <Footer cycle={cycle} />
        </Page>
      )}

      {report.cards.length > 0 && (
        <Page size="LETTER" style={s.page}>
          <Text style={[s.h2, { marginTop: 0 }]}>Coach-by-Coach Responses</Text>
          <Text style={s.intro}>Responses are shown as each coach submitted them.</Text>
          {report.cards.map((c) => (
            <View key={c.name}>
              <View wrap={false} minPresenceAhead={110}>
                <Text style={s.h3}>{c.name}</Text>
                <Text style={s.meta}>{c.meta}</Text>
              </View>
              {c.rows.length > 0
                ? <Table columns={[{ title: 'Topic', width: '26%' }, { title: 'Response', width: '74%' }]} rows={c.rows} />
                : <Text style={s.muted}>No written answers.</Text>}
            </View>
          ))}
          <Footer cycle={cycle} />
        </Page>
      )}
    </Document>
  )
}

export async function buildSurveyPdf(cycle: SurveyCycle, assignments: SurveyAssignment[]) {
  registerFonts()
  return renderToBuffer(<ReportDocument report={buildReport(cycle, assignments)} />)
}
