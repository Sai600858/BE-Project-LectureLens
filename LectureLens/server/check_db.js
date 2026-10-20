const { all, get } = require('./src/db');

async function main() {
  const notes = await all('SELECT id, lecture_id, mode, title, content_markdown, visualizations_json FROM study_notes');
  console.log('--- STUDY NOTES ---');
  for (const n of notes) {
    console.log(`\nNote ID: ${n.id}, Lecture: ${n.lecture_id}, Mode: ${n.mode}, Title: ${n.title}`);
    console.log(`Markdown Preview:\n${n.content_markdown?.slice(0, 300)}`);
    console.log(`Visualizations: ${n.visualizations_json}`);
  }

  const generatedDocs = await all('SELECT * FROM generated_documents');
  console.log('\n--- GENERATED DOCUMENTS ---');
  for (const d of generatedDocs) {
    console.log(d);
  }

  const lectures = await all('SELECT * FROM lectures');
  console.log('\n--- ALL LECTURES ---');
  for (const l of lectures) {
    console.log(l.id, l.title, l.description);
  }

  const allScreens = await all('SELECT id, lecture_id, slide_title, extracted_text, structured_content_json FROM screen_contents');
  console.log('\n--- SCREEN CONTENTS ---');
  for (const s of allScreens) {
    console.log(s.id, s.lecture_id, s.slide_title);
    if (s.extracted_text) console.log('Text:', s.extracted_text.slice(0, 150));
    if (s.structured_content_json) console.log('Structured:', s.structured_content_json.slice(0, 150));
  }

  const allBoards = await all('SELECT id, lecture_id, extracted_text, structured_content_json FROM board_contents');
  console.log('\n--- BOARD CONTENTS ---');
  for (const b of allBoards) {
    console.log(b.id, b.lecture_id, b.extracted_text?.slice(0, 150));
  }
}

main().catch(console.error);
