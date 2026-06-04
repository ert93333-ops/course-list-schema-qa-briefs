# Course List Schema QA Briefs

Static browser-local MVP for Course list structured data QA.

## Public offer

Paste Course/ItemList JSON-LD, visible catalog notes, course count notes, provider notes, title/description notes, URL/canonical notes, page type, and owner notes to get a copyable course list schema QA brief before catalog launch or cleanup.

## Constraints

- no crawl
- no page fetch
- no LMS API
- no Rich Results Test
- no Search Console
- no backend or external database
- no education compliance, accreditation, eligibility, ranking, indexing, enrollment operations, or student-support advice

## Conversion path

The landing page includes pricing hypothesis, local purchase-intent capture, a public-safe GitHub issue handoff, and copyable request details.

## SEO asset

- [Course structured data checklist](https://ert93333-ops.github.io/course-list-schema-qa-briefs/course-structured-data-checklist.html)
- [Public launch checklist Gist](https://gist.github.com/ert93333-ops/c086420db83502a855eaf4102e1c47b8)

## Marketing test URLs

- Landing: `https://ert93333-ops.github.io/course-list-schema-qa-briefs/?utm_source=github&utm_medium=repo&utm_campaign=course_list_schema_qa_launch`
- Checklist: `https://ert93333-ops.github.io/course-list-schema-qa-briefs/course-structured-data-checklist.html?utm_source=github&utm_medium=repo&utm_campaign=course_structured_data_checklist`

## Smoke test

From the Hermes playbook root:

```bash
npm run workflow:course-list-schema-qa
```
