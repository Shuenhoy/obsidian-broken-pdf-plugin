## Obsidian BrokenPDF
(Forked from MSzturc/obsidian-better-pdf-plugin)

- Why it is named "BrokenPDF"?
- It is intended to display PDF file in many small pieces in canvas.

### Features (Better PDF Plugin)

- Insert a single PDF Page inside Note
- Insert a list or range of pages into Obsidian Note
- Hyperlink to PDF
- Scale the size of PDF Pages to fit Note layout
- Rotate PDF
- Cutout PDF Parts

### New Features
- Loaded locument cache
- Rendered PDF piece cache
- DPI setting
- Differnent DPI rendering for zoom-levels
- Lazy rendering
- Use relative(ratio) for rectangle
- Maximum cocurrency of rendering config.
- Support `file://`


### Syntax

|parameter|required|example|
|--|--|--|
|url  |yes  |`myPDF.pdf` or `subfolder/myPDF.pdf` or `[[MyFile.pdf]]` or `file://C:/Zotero/a.pdf`
|link|optional (default = false)| `true` or `false`
|page|optional (default = 1)|  `1` or `[1, [3, 6], 8] ` where `[3, 6]` is an inclusive range of pages. page = 0 is an alias for the whole document
|range|optional| `[1, 3]` Insert pages `1` to `3` (inclusive). Overwrites page.
|fit|optional (default = true)| `true` or `false`
|rotation|optional (default = 0)| `90` for 90deg or `-90` -90deg or `180`
|rect|optional (default = `\[0,0,1,1\]`)| offsetX, offsetY, sizeY, sizeX in ratio.

### Credits
- https://github.com/MSzturc/obsidian-better-pdf-plugin
