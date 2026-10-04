# Translation source

Edit `catalog.json`, never the generated `texts/*.lang` files.
Read `../docs/LOCALIZATION.md` and workspace `docs/localization.md` before adding or revising text.
New gameplay text requires full context and translations in every requested locale in the same feature change.
`based_on` is a SHA-256 of source, context, placeholders and mod terminology: use the shared `revision(entry, catalog.get("glossary"))` helper only after reviewing the actual wording.
Translations remain AI drafts until independently reviewed; retain reviewed text and its evidence.
