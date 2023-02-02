import { Plugin, Plugin_2, TFile, normalizePath, FileSystemAdapter } from "obsidian";
import { BetterPdfSettings, BetterPdfSettingsTab } from "./settings";
import * as pdfjs from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.js";

import AsyncMap from "./asyncMap";
import PQueue from 'p-queue';

import { readBinary } from "./helper";
interface PdfNodeParameters {
	range: Array<number>;
	url: string;
	link: boolean;
	page: number | Array<number | Array<number>>;
	fit: boolean,
	rotation: number;
	rect: Array<number>;
}

export default class BetterPDFPlugin extends Plugin {
	settings: BetterPdfSettings;
	documents: AsyncMap<string, pdfjs.PDFDocumentProxy>
	pqueue: PQueue
	async onload() {
		console.log("Better PDF loading...");
		this.pqueue = new PQueue({ concurrency: 1 })

		this.settings = Object.assign(new BetterPdfSettings(), await this.loadData());
		this.addSettingTab(new BetterPdfSettingsTab(this.app, this));
		this.documents = new AsyncMap()
		pdfjs.GlobalWorkerOptions.workerSrc = worker;
		this.registerMarkdownCodeBlockProcessor("pdf", async (src, el, ctx) => {
			// Get Parameters
			let parameters: PdfNodeParameters = null;
			try {
				parameters = this.readParameters(src);
			} catch (e) {
				el.createEl("h2", { text: "PDF Parameters invalid: " + e.message });
			}
			const PRINT_RESOLUTION = this.settings.render_dpi;
			const PRINT_UNITS = PRINT_RESOLUTION / 72.0;
			//Create PDF Node
			if (parameters !== null) {
				// console.log("Creating PDF Node with parameters: ", parameters);
				try {
					if (parameters.url.startsWith("./")) {
						// find the substring of path all the way to the last slash
						const filePath = ctx.sourcePath;
						const folderPath = filePath.substring(0, filePath.lastIndexOf("/"));
						parameters.url = folderPath + "/" + parameters.url.substring(2, parameters.url.length);
					}

					const document = await this.documents.getOrSetAsync(parameters.url, async () => {
						return await pdfjs.getDocument(await readBinary(parameters.url)).promise;
					});


					// page parameter as trigger for whole pdf, 0 = all pages
					if ((<number[]>parameters.page).includes(0)) {
						var pagesArray = [];
						for (var i = 1; i <= document.numPages; i++) {
							pagesArray.push(i);
						}
						parameters.page = pagesArray;
					}


					//Read pages
					for (const pageNumber of <number[]>parameters.page) {
						const page = await document.getPage(pageNumber);
						let host = el;

						// Create hyperlink for Page
						if (parameters.link) {
							const href = el.createEl("a");
							href.href = parameters.url + "#page=" + pageNumber;
							href.className = "internal-link";

							host = href;
						}
						// Render Canvas
						const canvas = host.createEl("canvas");
						if (parameters.fit) {
							canvas.style.width = "100%";
						}
						if (canvas.clientWidth == 0) continue;

						const pageViewport = page.getViewport({ scale: 1.0 });

						const viewportWidth = Math.floor(pageViewport.width * parameters.rect[3]);
						const viewportHeight = Math.floor(pageViewport.height * parameters.rect[2]);

						const canvasWidth = viewportWidth * window.devicePixelRatio * PRINT_UNITS;
						const canvasHeight = Math.floor(canvasWidth / viewportWidth * viewportHeight);

						let baseScale = canvasWidth / viewportWidth;
						// Get Viewport
						const offsetX = Math.floor(
							parameters.rect[0] * -1 * pageViewport.width * baseScale
						);
						const offsetY = Math.floor(
							parameters.rect[1] * -1 * pageViewport.height * baseScale
						);



						const context = canvas.getContext("2d");

						const viewport = page.getViewport({
							scale: baseScale,
							rotation: parameters.rotation,
							offsetX: offsetX,
							offsetY: offsetY,
						});


						canvas.width = canvasWidth;
						canvas.height = canvasHeight;

						new ResizeObserver(() => {
							console.log(canvas.clientWidth);
						}).observe(canvas);

						let renderTask: pdfjs.RenderTask

						new IntersectionObserver((changes, observer) => {
							if (changes[0].isIntersecting) {
								const renderContext = {
									canvasContext: context,
									viewport: viewport,
									intent: "print"
								};
								this.pqueue.add(() => {
									renderTask = page.render(renderContext)
									return renderTask.promise.then(() => { renderTask = null; })
								});

							} else {
								if (renderTask)
									renderTask.cancel()
								canvas.width = 0
								canvas.height = 0

								canvas.width = canvasWidth
								canvas.height = canvasHeight


							}
						}).observe(canvas);


					}
				} catch (error) {
					el.createEl("h2", { text: error });
				}
			}
		});
	}

	private readParameters(jsonString: string) {
		// "url" : [[file.pdf]] is an invalid json since it misses quotation marks in value
		if (jsonString.contains("[[") && !jsonString.contains('"[[')) {
			jsonString = jsonString.replace("[[", '"[[');
			jsonString = jsonString.replace("]]", ']]"');
		}

		const parameters: PdfNodeParameters = JSON.parse(jsonString);

		//Transform internal Link to external
		if (parameters.url.startsWith("[[")) {
			parameters.url = parameters.url.substr(2, parameters.url.length - 4);
			parameters.url = this.app.metadataCache.getFirstLinkpathDest(
				parameters.url,
				""
			).path;
		}

		if (parameters.link === undefined) {
			parameters.link = this.settings.link_by_default;
		}

		//Convert Range (if present) and Page to Array<Page>
		if (parameters.range !== undefined) {
			parameters.page = Array.from({ length: parameters.range[1] - parameters.range[0] + 1 }, (_, i) => parameters.range[0] + i);
		}

		if (typeof parameters.page === "number") {
			parameters.page = [parameters.page];
		}
		if (parameters.page === undefined) {
			parameters.page = [1];
		}

		// Flatten ranges
		for (let i = 0; i < parameters.page.length; i++) {
			if (Array.isArray(parameters.page[i])) {
				const range = parameters.page.splice(i, 1)[0] as Array<number>;
				for (let j = range[0]; j <= range[1]; j++) {
					parameters.page.splice(i, 0, j);
					i += 1;
				}
			}
		}

		if (parameters.fit === undefined) {
			parameters.fit = this.settings.fit_by_default;
		}

		if (parameters.rotation === undefined) {
			parameters.rotation = 0;
		}

		if (parameters.rect === undefined) {
			parameters.rect = [0, 0, 1, 1];
		}
		return parameters;
	}

	onunload() {
		console.log("unloading Better PDF plugin...");
	}
}
