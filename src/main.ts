import { Plugin } from "obsidian";
import { BetterPdfSettings, BetterPdfSettingsTab } from "./settings";
import * as pdfjs from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.js";

import AsyncLRU from "./asyncMap";
import PQueue from 'p-queue';
import hash from "object-hash"

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

class DivWithDisconnected extends HTMLDivElement {
	static ID = "e10d176d-3a0d-456a-ada7-b7d178778f07";

	constructor() {
		super()
		this.style.width = "100%";
	}

	disconnectedCallback() {
		this.dispatchEvent(new CustomEvent("disconnected"))
	}
}

interface PageRenderProxy {
	container: DivWithDisconnected
	canvas: HTMLCanvasElement
	page: pdfjs.PDFPageProxy
	viewport: pdfjs.PageViewport
	canvasWidth: number
	canvasHeight: number
	baseScale: number
}

export default class BetterPDFPlugin extends Plugin {

	settings: BetterPdfSettings;
	documents: AsyncLRU<string, pdfjs.PDFDocumentProxy>
	renderProxies: AsyncLRU<string, PageRenderProxy>
	pqueue: PQueue

	async onload() {
		console.log("Better PDF loading...");

		this.settings = Object.assign(new BetterPdfSettings(), await this.loadData());
		this.pqueue = new PQueue({ concurrency: this.settings.cocurrency });

		this.addSettingTab(new BetterPdfSettingsTab(this.app, this));
		this.documents = new AsyncLRU({ max: this.settings.max_cached_opened_files });
		this.renderProxies = new AsyncLRU({ max: 10 });

		if (!customElements.get(DivWithDisconnected.ID)) {
			customElements.define(DivWithDisconnected.ID, DivWithDisconnected, { extends: "div" });
		}

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
						await this.renderPage(host, parameters, page, PRINT_UNITS);
					}
				} catch (error) {
					el.createEl("h2", { text: error });
				}
			}
		});
	}

	private async renderPage(host: HTMLElement, parameters: PdfNodeParameters, page: pdfjs.PDFPageProxy, PRINT_UNITS: number) {
		const div = window.document.createElement("div", { is: DivWithDisconnected.ID }) as DivWithDisconnected;
		const self = this;
		host.appendChild(div);

		const zoomLevels = [0.01, 0.25, 0.5, 0.75, 1.0];
		const zoomLevelSeps = [0.1, 0.35, 0.6, 0.85, 1.0];
		const blockHash = hash([parameters.url, parameters.rect, parameters.rotation, page.pageNumber]);

		if (div.clientWidth == 0) return;


		const zoomContainer = host.closest("div.view-content > div.canvas-wrapper");

		let mutation: MutationObserver = null;
		let resize: ResizeObserver = null;
		let proxy: PageRenderProxy = await getProxy();
		let canvas: HTMLCanvasElement = this.createCanvas(parameters);
		let renderTask: pdfjs.RenderTask
		let zoom = 1.0;

		canvas.width = proxy.canvasWidth;
		canvas.height = proxy.canvasHeight;
		div.appendChild(canvas);
		proxy = null;

		const intersection = new IntersectionObserver(async (changes, _) => {
			if (changes[0].isIntersecting) {
				proxy = await getProxy();

				const resizer = async () => {
					if (canvas.clientWidth == 0) return;
					const zoomLevel = calcZoomLevel(proxy.canvasWidth, canvas);
					if (zoomLevels[zoomLevel] != zoom) {
						zoom = zoomLevels[zoomLevel];

						if (renderTask)
							renderTask.cancel();
						const [task, render] = await this.submitRender(proxy, zoom, canvas);
						renderTask = task;
						await render.finally(() => { renderTask = null; });
						if (proxy)
							this.copyCanvas(canvas, proxy.canvas);
					}

				};
				if (zoomContainer) {
					mutation = new MutationObserver(resizer); mutation.observe(zoomContainer, { attributes: true, attributeFilter: ["style"] });
					resize = new ResizeObserver(resizer); resize.observe(div);
				}

				this.copyCanvas(proxy.canvas, canvas);
				const zoomLevel = calcZoomLevel(proxy.canvasWidth, canvas);
				zoom = zoomLevels[zoomLevel];


				if (renderTask)
					renderTask.cancel();
				const [task, render] = await this.submitRender(proxy, zoom, canvas);
				renderTask = task;
				await render.finally(() => { renderTask = null; });

				this.copyCanvas(canvas, proxy.canvas);

			} else {
				if (renderTask)
					renderTask.cancel();
				if (mutation) mutation.disconnect();
				if (resize) resize.disconnect();
				if (canvas) {
					resetCanvas(canvas, proxy.canvasWidth, proxy.canvasHeight, zoom);
				}
				proxy = null;
			}
		}, { rootMargin: '50%' });
		intersection.observe(div); // the rootMargin here does not work




		async function getProxy() {
			return await self.renderProxies.getOrSetAsync(blockHash, async () => {
				const canvas = self.createCanvas(parameters);
				const { canvasWidth, canvasHeight, viewport, baseScale } = self.pageViewport(page, parameters, PRINT_UNITS);

				let zoomLevel = calcZoomLevel(canvasWidth, canvas);
				const zoom = zoomLevels[zoomLevel];
				resetCanvas(canvas, canvasWidth, canvasHeight, zoom);
				const proxy: PageRenderProxy = {
					container: div,
					canvas,
					canvasWidth,
					canvasHeight,
					page, viewport, baseScale
				};
				return proxy;
			});
		}

		function resetCanvas(canvas: HTMLCanvasElement, canvasWidth: number, canvasHeight: number, zoom: number) {
			canvas.width = 0;
			canvas.height = 0;
			canvas.width = Math.floor(canvasWidth * zoom);
			canvas.height = Math.floor(canvasHeight * zoom);
		}

		function calcZoomLevel(canvasWidth: number, canvas: HTMLCanvasElement) {
			let zoomLevel = 4;
			const realWidth = canvas.getBoundingClientRect().width;
			const ratio = realWidth / canvasWidth;
			for (let i = 0; i < zoomLevels.length; i++) {
				if (ratio <= zoomLevelSeps[i]) {
					zoomLevel = i;
					break;
				}
			}
			return zoomLevel;
		}
	}

	private submitRender(proxy: PageRenderProxy, zoom: number, target: HTMLCanvasElement) {
		const canvas = window.document.createElement("canvas")
		const context = canvas.getContext("2d");
		canvas.width = proxy.canvasWidth * zoom;
		canvas.height = proxy.canvasHeight * zoom;

		return this.pqueue.add(() => {

			const renderTask = proxy.page.render({
				canvasContext: context,
				viewport: proxy.viewport,
				transform: [proxy.baseScale * zoom, 0, 0, proxy.baseScale * zoom, 0, 0]
			});
			return [renderTask, renderTask.promise.then(() => {
				target.width = Math.floor(proxy.canvasWidth * zoom);
				target.height = Math.floor(proxy.canvasHeight * zoom);

				target.getContext("2d").drawImage(canvas, 0, 0);
				canvas.width = 0
				canvas.height = 0
			})] as const;
		});
	}

	private pageViewport(page: pdfjs.PDFPageProxy, parameters: PdfNodeParameters, PRINT_UNITS: number) {
		const pageViewport = page.getViewport({ scale: 1.0 });

		const viewportWidth = Math.floor(pageViewport.width * parameters.rect[3]);
		const viewportHeight = Math.floor(pageViewport.height * parameters.rect[2]);

		const canvasWidth = viewportWidth * window.devicePixelRatio * PRINT_UNITS;
		const canvasHeight = Math.floor(canvasWidth / viewportWidth * viewportHeight);

		let baseScale = canvasWidth / viewportWidth;
		// Get Viewport
		const offsetX = Math.floor(
			parameters.rect[0] * -1 * pageViewport.width
		);
		const offsetY = Math.floor(
			parameters.rect[1] * -1 * pageViewport.height
		);

		const viewport = page.getViewport({
			scale: 1,
			rotation: parameters.rotation,
			offsetX: offsetX,
			offsetY: offsetY,
		});
		return { canvasWidth, canvasHeight, viewport, baseScale };
	}

	private createCanvas(parameters: PdfNodeParameters) {
		const canvas = document.createElement("canvas")
		canvas.style.backgroundColor = "white";
		if (parameters.fit) {
			canvas.style.width = "100%";
		}
		return canvas;
	}
	private copyCanvas(oldCanvas: HTMLCanvasElement, targetCanvas: HTMLCanvasElement) {
		const context = targetCanvas.getContext("2d");
		targetCanvas.width = oldCanvas.width;
		targetCanvas.height = oldCanvas.height;
		context.drawImage(oldCanvas, 0, 0);
	}

	private cloneCanvas(oldCanvas: HTMLCanvasElement, parameters: PdfNodeParameters) {
		const newCanvas = this.createCanvas(parameters);
		const context = newCanvas.getContext("2d");
		newCanvas.width = oldCanvas.width;
		newCanvas.height = oldCanvas.height;
		context.drawImage(oldCanvas, 0, 0);
		return newCanvas;
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
		this.documents.map.clear();
	}
}
