const TEAM: [string, number, string, number][] = [["Example: Member A", 82, "Active", 5], ["Example: Member B", 64, "Ready for Level 2", 5], ["Example: Member C", 31, "Stuck on Week 2", 1], ["Example: Member D", 12, "No activity for 6 days", 0], ["Example: Member E", 97, "Active", 6]];

export default function Team() {
  return (
    <>
      <h2 style={{ marginTop: 16 }}>Team dashboard</h2>
      <div className="demo">Leader view with example data. It will show real team progress once accounts and the database are connected.</div>
      <div className="grid">
        <div className="card"><div className="big">18 h</div><p className="muted small">Live training time avoided this month (example)</p></div>
        <div className="card"><div className="big">76%</div><p className="muted small">Team completion of Weeks 1 to 3 (example)</p></div>
        <div className="card"><div className="big">2</div><p className="muted small">Members ready for Level 2 (example)</p></div>
      </div>
      <div className="card scroll" style={{ marginTop: 12 }}>
        <table><thead><tr><th>Member</th><th>Progress</th><th>Status</th><th>Streak</th></tr></thead><tbody>
          {TEAM.map(([n, pr, s, k]) => (
            <tr key={n}><td>{n}</td><td style={{ minWidth: 120 }}><div className="bar"><i style={{ width: `${pr}%` }} /></div></td>
              <td><span className={`chip ${s.startsWith("Stuck") || s.startsWith("No") ? "red" : s.startsWith("Ready") ? "amber" : ""}`}>{s}</span></td><td>{k} days</td></tr>
          ))}</tbody></table>
      </div>
    </>
  );
}
