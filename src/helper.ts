export async function readBinary(url: string, zoteroRoot: string) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'file:') {
            const fs = (window as any).app.vault.adapter.fsPromises;

            const buffer: Buffer = await fs.readFile((x => (x.contains(':/') ? x.substring(1) : x))(
                decodeURI(parsed.pathname).replaceAll('\\', '/')
            ));

            return buffer
        } else if (parsed.protocol == 'zotero:') {
            const fs = (window as any).app.vault.adapter.fsPromises;
            const p = (x => (x.contains(':/') ? x.substring(1) : x))(
                decodeURI(parsed.pathname).replaceAll('\\', '/')
            );
            const buffer: Buffer = await fs.readFile(`${zoteroRoot}/${p}`);

            return buffer

        }
    } catch (err) { }
    return Buffer.from(await app.vault.adapter.readBinary(url));

}