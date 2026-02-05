// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
    Directive,
    Input,
    AfterViewInit,
    ElementRef,
    OnChanges,
    SimpleChange,
    Output,
    EventEmitter,
    OnDestroy,
} from '@angular/core';
import { CoreFile, CoreFileProvider } from '@services/file';
import { CoreFilepool, CoreFilepoolFileActions, CoreFilepoolFileEventData } from '@services/filepool';
import { CoreUrlUtils } from '@services/utils/url';
import { CoreLogger } from '@singletons/logger';
import { CoreSite } from '@classes/sites/site';
import { CoreEventObserver, CoreEvents } from '@singletons/events';

import { CoreNetwork } from '@services/network';
import { AsyncDirective } from '@classes/async-directive';
import { CoreDirectivesRegistry } from '@singletons/directives-registry';
import { CorePromisedValue } from '@classes/promised-value';


import { ThCoreFilepool } from '../services/th-filepool';
import { CoreExternalContentDirective } from '@directives/external-content';


/**
 * Directive to handle external content.
 *
 * This directive should be used with any element that links to external content
 * which we want to have available when the app is offline. Typically media and links.
 *
 * If a file is downloaded, its URL will be replaced by the local file URL.
 *
 * This directive also downloads inline styles, so it can be used in any element as long as it has inline styles.
 */
@Directive({
    selector: '[core-external-content]',
})
export class ThCoreExternalContentDirective extends CoreExternalContentDirective implements AfterViewInit, OnChanges, OnDestroy, AsyncDirective {

    @Input() siteId?: string; // Site ID to use.
    @Input() component?: string; // Component to link the file to.
    @Input() componentId?: string | number; // Component ID to use in conjunction with the component.
    @Input() url?: string | null; // The URL to use in the element, either as src or href.
    @Input() posterUrl?: string | null; // The poster URL.
    /**
     * @deprecated since 4.4. Use url instead.
     */
    @Input() src?: string;
    /**
     * @deprecated since 4.4. Use url instead.
     */
    @Input() href?: string;
    /**
     * @deprecated since 4.4. Use posterUrl instead.
     */
    @Input() poster?: string;
    @Output() onLoad = new EventEmitter(); // Emitted when content is loaded. Only for images.

    loaded = false;
    invalid = false;
    protected element: Element;
    protected logger: CoreLogger;
    protected initialized = false;
    protected fileEventObserver?: CoreEventObserver;
    protected onReadyPromise = new CorePromisedValue<void>();

    constructor(element: ElementRef) {
        super(element);
        this.element = element.nativeElement;
        this.logger = CoreLogger.getInstance('CoreExternalContentDirective');

        CoreDirectivesRegistry.register(this.element, this);
    }

    /**
     * @inheritdoc
     */
    ngAfterViewInit(): void {
        this.checkAndHandleExternalContent();

        this.initialized = true;
    }

    /**
     * @inheritdoc
     */
    ngOnChanges(changes: { [name: string]: SimpleChange }): void {
        if (changes && this.initialized) {
            // If any of the inputs changes, handle the content again.
            this.checkAndHandleExternalContent();
        }
    }



    /**
     * Set the URL to the element.
     *
     * @param targetAttr Name of the attribute to set.
     * @param url URL to set.
     */
    protected setElementUrl(targetAttr: string, url: string): void {
        if (!url) {
            // Ignore empty URLs.
            if (this.element.tagName === 'IMG') {
                this.onLoad.emit();
                this.loaded = true;
            }

            return;
        }

        if (this.element.tagName === 'SOURCE') {
            // The WebView does not detect changes in SRC, we need to add a new source.
            this.addSource(url);
        } else {
            this.element.setAttribute(targetAttr, url);

            const originalUrl = targetAttr === 'poster' ?
                (this.posterUrl ?? this.poster) : // eslint-disable-line deprecation/deprecation
                (this.url ?? this.src ?? this.href); // eslint-disable-line deprecation/deprecation
            if (originalUrl && originalUrl !== url) {
                this.element.setAttribute('data-original-' + targetAttr, originalUrl);
            }
        }

        if (this.element.tagName !== 'IMG') {
            return;
        }

        if (url.startsWith('data:')) {
            this.onLoad.emit();
            this.loaded = true;
        } else {
            this.loaded = false;
            this.waitForLoad();
        }
    }


    /**
     * Get the URL to use in the element. E.g. if the file is already downloaded it will return the local URL.
     *
     * @param targetAttr Attribute to modify.
     * @param url Original URL to treat.
     * @param site Site.
     * @returns Promise resolved with the URL.
     */
    protected async getUrlToUse(targetAttr: string, url: string, site?: CoreSite): Promise<string> {
        if (!site) {
            return this.getUrlForNoSite(url);
        }
        console.log("Hello getUrlToUse here");
        const tagName = this.element.tagName;
        let finalUrl: string;

        // Download images, tracks and posters if size is unknown.
        const downloadUnknown = tagName == 'IMG' || tagName == 'TRACK' || targetAttr == 'poster';

        if (targetAttr === 'src' && tagName !== 'SOURCE' && tagName !== 'TRACK' && tagName !== 'VIDEO' && tagName !== 'AUDIO') {
            finalUrl = await ThCoreFilepool.getSrcByUrl(
                site.getId(),
                url,
                this.component,
                this.componentId,
                0,
                true,
                downloadUnknown,
            );
        } else if (tagName === 'TRACK') {
            // Download tracks right away. Using an online URL for tracks can give a CORS error in Android.
            finalUrl = await CoreFilepool.downloadUrl(site.getId(), url, false, this.component, this.componentId);

            finalUrl = CoreFile.convertFileSrc(finalUrl);
        } else {
            finalUrl = await ThCoreFilepool.getUrlByUrl(
                site.getId(),
                url,
                this.component,
                this.componentId,
                0,
                true,
                downloadUnknown,
            );

            finalUrl = CoreFile.convertFileSrc(finalUrl);
        }

        if (!CoreUrlUtils.isLocalFileUrl(finalUrl) && !finalUrl.includes('#') && tagName !== 'A') {
            /* In iOS, if we use the same URL in embedded file and background download then the download only
               downloads a few bytes (cached ones). Add an anchor to the URL so both URLs are different.
               Don't add this anchor if the URL already has an anchor, otherwise other anchors might not work.
               The downloaded URL won't have anchors so the URLs will already be different. */
            finalUrl = finalUrl + '#moodlemobile-embedded';
        }

        return finalUrl;
    }




    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.fileEventObserver?.off();
    }

    /**
     * @inheritdoc
     */
    async ready(): Promise<void> {
        return this.onReadyPromise;
    }

}
