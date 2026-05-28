export interface NewspaperData {
  names: { a: string; b: string };
  weekStart: string; // ISO date string or formatted date
  editionNumber: number;
  stats: {
    photos_count: number;
    tasks_done_count: number;
    rules_broken_count: number;
    focus_minutes: number;
    watch_sessions_count: number;
    captures_count: number;
  };
  qa: { question: string; answerA: string; answerB: string } | null;
  dictWord: { word: string; meaning: string } | null;
  watchTitle: string | null;
}

export function renderNewspaper(data: NewspaperData): string {
  const { names, weekStart, editionNumber, stats, qa, dictWord, watchTitle } = data;

  const dateObj = new Date(weekStart);
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The ${names.a} & ${names.b} Times</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap');

  :root {
    --paper: #f4f1ea;
    --ink: #2b2b2b;
    --divider: #d3ccc1;
  }

  body {
    background-color: var(--paper);
    color: var(--ink);
    font-family: 'EB Garamond', serif;
    margin: 0;
    padding: 2rem;
    line-height: 1.5;
  }

  .newspaper-container {
    max-width: 900px;
    margin: 0 auto;
    background: var(--paper);
    box-shadow: 0 0 20px rgba(0,0,0,0.05);
    padding: 3rem;
  }

  header {
    text-align: center;
    border-bottom: 4px double var(--ink);
    margin-bottom: 2rem;
    padding-bottom: 1rem;
  }

  h1.masthead {
    font-family: 'Playfair Display', serif;
    font-size: 4rem;
    font-weight: 700;
    margin: 0;
    line-height: 1.1;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .subhead {
    display: flex;
    justify-content: space-between;
    text-transform: uppercase;
    font-size: 0.9rem;
    letter-spacing: 1px;
    margin-top: 1rem;
    border-top: 1px solid var(--ink);
    border-bottom: 1px solid var(--ink);
    padding: 0.25rem 0;
  }

  .content-grid {
    column-count: 2;
    column-gap: 3rem;
    column-rule: 1px solid var(--divider);
  }

  article {
    break-inside: avoid;
    margin-bottom: 2rem;
  }

  h2 {
    font-family: 'Playfair Display', serif;
    font-size: 1.8rem;
    border-bottom: 1px solid var(--divider);
    padding-bottom: 0.5rem;
    margin-top: 0;
  }

  h3 {
    font-family: 'Playfair Display', serif;
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
  }

  p {
    margin-top: 0;
    text-align: justify;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stat-box {
    text-align: center;
    padding: 1rem;
    border: 1px solid var(--divider);
    background: rgba(0,0,0,0.02);
  }

  .stat-value {
    display: block;
    font-family: 'Playfair Display', serif;
    font-size: 2.5rem;
    font-weight: bold;
    line-height: 1;
  }

  .stat-label {
    display: block;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 0.5rem;
  }

  .quote {
    font-style: italic;
    font-size: 1.1rem;
    padding: 1rem;
    border-left: 3px solid var(--ink);
    background: rgba(0,0,0,0.02);
  }

  @media (max-width: 768px) {
    .content-grid {
      column-count: 1;
    }
    .newspaper-container {
      padding: 1.5rem;
    }
    h1.masthead {
      font-size: 2.5rem;
    }
  }
</style>
</head>
<body>
  <div class="newspaper-container">
    <header>
      <h1 class="masthead">The ${names.a} &amp; ${names.b} Times</h1>
      <div class="subhead">
        <span>Edition No. ${editionNumber}</span>
        <span>Week of ${formattedDate}</span>
        <span>Two Cents</span>
      </div>
    </header>

    <div class="content-grid">
      <article>
        <h2>The Weekly Report</h2>
        <p>Another week has passed in the shared lives of ${names.a} and ${names.b}. Records indicate a flurry of activity, logged meticulously for posterity.</p>
        
        <div class="stats-grid">
          <div class="stat-box">
            <span class="stat-value">${stats.photos_count || 0}</span>
            <span class="stat-label">Photos Shared</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${stats.captures_count || 0}</span>
            <span class="stat-label">Sync Captures</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${stats.tasks_done_count || 0}</span>
            <span class="stat-label">Tasks Completed</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${stats.focus_minutes || 0}</span>
            <span class="stat-label">Focus Minutes</span>
          </div>
        </div>

        ${
          stats.rules_broken_count > 0
            ? `<p>It is worth noting that ${stats.rules_broken_count} rule infraction(s) were recorded in the ledger this week. We await further disciplinary action.</p>`
            : `<p>Commendably, no rule infractions were recorded in the ledger. A civilized week indeed.</p>`
        }
      </article>

      ${
        qa
          ? `<article>
              <h2>Question of the Week</h2>
              <p><strong>${qa.question}</strong></p>
              <div class="quote">
                <p><strong>${names.a}:</strong> "${qa.answerA}"</p>
                <p><strong>${names.b}:</strong> "${qa.answerB}"</p>
              </div>
            </article>`
          : `<article>
              <h2>Question of the Week</h2>
              <p class="quote">The archives remain silent this week. Neither party provided testimony.</p>
            </article>`
      }

      ${
        dictWord
          ? `<article>
              <h2>Dictionary Spotlight</h2>
              <h3>${dictWord.word}</h3>
              <p>${dictWord.meaning}</p>
            </article>`
          : `<article>
              <h2>Dictionary Spotlight</h2>
              <p>No new linguistic developments were recorded this week.</p>
            </article>`
      }

      <article>
        <h2>Culture & Leisure</h2>
        ${
          stats.watch_sessions_count > 0 && watchTitle
            ? `<p>The pair engaged in ${stats.watch_sessions_count} synchronized viewing session(s). Most recently, they were observed watching <em>${watchTitle}</em>.</p>`
            : stats.watch_sessions_count > 0
            ? `<p>The pair engaged in ${stats.watch_sessions_count} synchronized viewing session(s).</p>`
            : `<p>A quiet week for culture. No watch sessions were recorded.</p>`
        }
      </article>

    </div>
  </div>
</body>
</html>
  `.trim();
}
