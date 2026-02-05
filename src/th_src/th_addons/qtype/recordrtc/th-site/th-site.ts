import { CoreUrlUtils } from '@services/utils/url';
import { CoreNetwork } from '@services/network';
import {
    CoreWS,
    CoreWSFileUploadOptions,
    CoreWSExternalWarning,
    CoreWSUploadFileResult,
} from '@services/ws';
import { CoreAuthenticatedSite } from '@classes/sites/authenticated-site';

export class CoreSite extends CoreAuthenticatedSite {
    protected tokenPluginFileWorks?: boolean;
    protected tokenPluginFileWorksPromise?: Promise<boolean>;
    fixPluginfileURL(url: string): string {
        const accessKey = this.tokenPluginFileWorks || this.tokenPluginFileWorks === undefined ?
            this.infos && this.infos.userprivateaccesskey : undefined;
        console.log("Hello here fixPluginfileURL accessKey: ", accessKey);
        return CoreUrlUtils.fixPluginfileURL(url, this.token || '', this.siteUrl, accessKey);
    }
    checkTokenPluginFile(url: string): Promise<boolean> {
        if (!CoreUrlUtils.canUseTokenPluginFile(url, this.siteUrl, this.infos && this.infos.userprivateaccesskey)) {
            // Cannot use tokenpluginfile.
            return Promise.resolve(false);
        } else if (this.tokenPluginFileWorks !== undefined) {
            // Already checked.
            return Promise.resolve(this.tokenPluginFileWorks);
        } else if (this.tokenPluginFileWorksPromise) {
            // Check ongoing, use the same promise.
            return this.tokenPluginFileWorksPromise;
        } else if (!CoreNetwork.isOnline()) {
            // Not online, cannot check it. Assume it's working, but don't save the result.
            return Promise.resolve(true);
        }

        url = this.fixPluginfileURL(url);

        this.tokenPluginFileWorksPromise = CoreWS.urlWorks(url).then((result) => {
            this.tokenPluginFileWorks = result;

            return result;
        });

        return this.tokenPluginFileWorksPromise;
    }

    checkAndFixPluginfileURL(url: string): Promise<string> {

        console.log("Hello here checkAndFixPluginfileURL url", url);

        return this.checkTokenPluginFile(url).then(() => {

            console.log("Hello here checkAndFixPluginfileURL url 2", url);

            return this.fixPluginfileURL(url)
        });
    }
}
