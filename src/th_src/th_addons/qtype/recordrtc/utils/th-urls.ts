import { Injectable } from "@angular/core";
import { CoreTextUtils } from "@services/utils/text";
import { CoreUrlUtilsProvider } from "@services/utils/url";
import { makeSingleton } from "@singletons";
import { CorePath } from "@singletons/path";





@Injectable({ providedIn: 'root' })
export class ThCoreUrlUtilsProvider extends CoreUrlUtilsProvider {


    fixPluginfileURL(url: string, token: string, siteUrl: string, accessKey?: string): string {

        console.log("Hello here fixPluginfileURL", url);

        if (!url) {
            return '';
        }

        url = url.replace(/&amp;/g, '&');

        const canUseTokenPluginFile = accessKey && this.canUseTokenPluginFile(url, siteUrl, accessKey);

        console.log("Hello here fixPluginfileURL in th-urls", url);


        // First check if we need to fix this url or is already fixed.
        if (!canUseTokenPluginFile && url.indexOf('token=') != -1) {

            console.log("Hello here fixPluginfileURL canUseTokenPluginFile url 4", url);
            console.log("Hello here fixPluginfileURL canUseTokenPluginFile token", token);


            return url;
        }

        // Check if is a valid URL (contains the pluginfile endpoint) and belongs to the site.
        if (!this.isPluginFileUrl(url) || url.indexOf(CoreTextUtils.addEndingSlash(siteUrl)) !== 0) {

            console.log("Hello here fixPluginfileURL canUseTokenPluginFile url 5", url);
            console.log("Hello here fixPluginfileURL canUseTokenPluginFile token", token);
            if (url.includes("draftfile.php")) {
                // Replace "draftfile.php" with "question/type/thvstepcluster/thtokendraftfile.php"
                url = url.replace("draftfile.php", `question/type/thvstepcluster/thtokendraftfile.php/${accessKey}`);
                console.log('hello url thtokendraftfile', url);
                return url;
            }

            url = url.replace('thpluginfile.php', `thtokenpluginfile.php/${accessKey}`);

            console.log('url thay the', url);
            return url;
        }

        if (canUseTokenPluginFile) {
            // Use tokenpluginfile.php.

            console.log("Hello here fixPluginfileURL canUseTokenPluginFile url", url);

            url = url.replace(/(\/webservice)?\/pluginfile\.php/, '/tokenpluginfile.php/' + accessKey);
        } else {

            console.log("Hello here fixPluginfileURL canUseTokenPluginFile url 3", url);
            console.log("Hello here fixPluginfileURL canUseTokenPluginFile token", token);

            // Use pluginfile.php. Some webservices returns directly the correct download url, others not.
            if (url.indexOf(CorePath.concatenatePaths(siteUrl, 'pluginfile.php')) === 0) {
                url = url.replace('/pluginfile', '/webservice/pluginfile');
            }

            url = this.addParamsToUrl(url, { token });
        }

        return this.addParamsToUrl(url, { offline: '1' }); // Always send offline=1 (it's for external repositories).
    }
}

export const ThCoreUrlUtils = makeSingleton(ThCoreUrlUtilsProvider);

export type CoreUrlParams = { [key: string]: string };
