import { Injectable } from '@angular/core';
import { CoreFilepool, CoreFilepoolProvider } from '@services/filepool';
import { CorePluginFileDelegate } from '@services/plugin-file-delegate';
import { CoreSites } from '@services/sites';
import { CoreWSFile } from '@services/ws';
import { makeSingleton } from '@singletons';
import { CoreSite } from '@classes/sites/site';
import { CoreUrlUtils } from '@services/utils/url';




class ThCoreSite extends CoreSite {

    fixPluginfileURL(url: string): string {
        const accessKey = this.tokenPluginFileWorks || this.tokenPluginFileWorks === undefined ?
            this.infos && this.infos.userprivateaccesskey : undefined;
        console.log("Hello here fixPluginfileURL accessKey in ThCoreFilepoolProvider: ", accessKey);
        return CoreUrlUtils.fixPluginfileURL(url, this.token || '', this.siteUrl, accessKey);
    }

    checkAndFixPluginfileURL(url: string): Promise<string> {

        console.log("Hello here extend checkAndFixPluginfileURL url 222", url);

        return this.checkTokenPluginFile(url).then(() => {

            console.log("Hello here extend checkAndFixPluginfileURL url 2222", url);

            return this.fixPluginfileURL(url)
        });
    }

}


@Injectable({ providedIn: 'root' })
export class ThCoreFilepoolProvider extends CoreFilepoolProvider {


    public async fixPluginfileURL(siteId: string, fileUrl: string, timemodified: number = 0): Promise<CoreWSFile> {
        const file = await CorePluginFileDelegate.getDownloadableFile({ fileurl: fileUrl, timemodified });
        const site = await CoreSites.getSite(siteId);
        // let thSite = await thCoreSite.getSite(siteId);
        //let thSite: ThCoreSite = site;
        const thSite = new ThCoreSite(site.id, site.siteUrl, site.token,
            {
                config: site.config, info: site.infos, loggedOut: site.loggedOut, privateToken: site.privateToken,
                publicConfig: await site.getPublicConfig()
            });


        console.log("Hello here fixPluginfileURL file", file);

        if ('fileurl' in file) {
            file.fileurl = await thSite.checkAndFixPluginfileURL(file.fileurl);
        } else {
            file.url = await thSite.checkAndFixPluginfileURL(file.url);
        }

        console.log("Hello here fixPluginfileURL file2", file);

        return file;
    }
}



export const ThCoreFilepool = makeSingleton(ThCoreFilepoolProvider);
