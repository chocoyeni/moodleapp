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
    ElementRef,
    ChangeDetectorRef,
    Directive,
} from '@angular/core';

import { CoreFormatTextDirective } from '@directives/format-text';
import { CoreExternalContentDirective } from '@directives/external-content';
import { ThCoreExternalContentDirective } from './th-external-content'

/**
 * Directive to format text rendered. It renders the HTML and treats all links and media, using CoreLinkDirective
 * and CoreExternalContentDirective. It also applies filters if needed.
 *
 * Please use this directive if your text needs to be filtered or it can contain links or media (images, audio, video).
 *
 * Example usage:
 * <core-format-text [text]="myText" [component]="component" [componentId]="componentId"></core-format-text>
 */
@Directive({
    selector: 'th-core-format-text',
})
export class ThCoreFormatTextDirective extends CoreFormatTextDirective {

    /**
     * Apply CoreExternalContentDirective to a certain element.
     *
     * @param element Element to add the attributes to.
     * @returns External content instance or undefined if siteId is not provided.
     */
    protected addExternalContent(element: Element): ThCoreExternalContentDirective | undefined {
        if (!this.siteId) {
            return;
        }

        console.log("Hello Extended here");

        // Angular doesn't let adding directives dynamically. Create the CoreExternalContentDirective manually.
        const extContent = new ThCoreExternalContentDirective(new ElementRef(element));

        extContent.component = this.component();
        extContent.componentId = this.componentId();
        extContent.siteId = this.siteId();
        extContent.url = element.getAttribute('src') ?? element.getAttribute('href') ?? element.getAttribute('xlink:href');
        extContent.posterUrl = element.getAttribute('poster');

        // Remove the original attributes to avoid performing req   uests to untreated URLs.
        element.removeAttribute('src');
        element.removeAttribute('href');
        element.removeAttribute('xlink:href');
        element.removeAttribute('poster');

        extContent.ngAfterViewInit();

        this.externalContentInstances.push(extContent);

        const changeDetectorRef = this.viewContainerRef.injector.get(ChangeDetectorRef);
        changeDetectorRef.markForCheck();

        return extContent;
    }



}