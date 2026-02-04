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

import { Injectable } from '@angular/core';
import { CoreComments } from '@features/comments/services/comments';
import { CoreCourseActivityPrefetchHandlerBase } from '@features/course/classes/activity-prefetch-handler';
import { CoreCourse, CoreCourseAnyModuleData } from '@features/course/services/course';
import { CoreCourses } from '@features/courses/services/courses';
import { CoreUser } from '@features/user/services/user';
import { CoreFilepool } from '@services/filepool';
import { CoreSitesReadingStrategy } from '@services/sites';
import { CorePromiseUtils } from '@singletons/promise-utils';
import { CoreWSFile } from '@services/ws';
import { makeSingleton } from '@singletons';
import { AddonModThGlossary, AddonModThGlossaryEntry, AddonModThGlossaryGlossary } from '../thglossary';
import { AddonModThGlossarySync, AddonModThGlossarySyncResult } from '../thglossary-sync';
import { ContextLevel } from '@/core/constants';
import { ADDON_MOD_TH_GLOSSARY_COMPONENT_LEGACY, ADDON_MOD_TH_GLOSSARY_MODNAME } from '../../constants';

/**
 * Handler to prefetch forums.
 */
@Injectable({ providedIn: 'root' })
export class AddonModThGlossaryPrefetchHandlerService extends CoreCourseActivityPrefetchHandlerBase {

    name = 'AddonModThGlossary';
    modName = ADDON_MOD_TH_GLOSSARY_MODNAME;
    component = ADDON_MOD_TH_GLOSSARY_COMPONENT_LEGACY;
    updatesNames = /^configuration$|^.*files$|^entries$/;

    /**
     * @inheritdoc
     */
    async getFiles(module: CoreCourseAnyModuleData, courseId: number): Promise<CoreWSFile[]> {
        try {
            const glossary = await AddonModThGlossary.getGlossary(courseId, module.id);

            const entries = await AddonModThGlossary.fetchAllEntries(
                (options) => AddonModThGlossary.getEntriesByLetter(glossary.id, options),
                {
                    cmId: module.id,
                },
            );

            return this.getFilesFromGlossaryAndEntries(module, glossary, entries);
        } catch {
            // Glossary not found, return empty list.
            return [];
        }
    }

    /**
     * Get the list of downloadable files. It includes entry embedded files.
     *
     * @param module Module to get the files.
     * @param glossary Glossary
     * @param entries Entries of the Glossary.
     * @returns List of Files.
     */
    protected getFilesFromGlossaryAndEntries(
        module: CoreCourseAnyModuleData,
        glossary: AddonModThGlossaryGlossary,
        entries: AddonModThGlossaryEntry[],
    ): CoreWSFile[] {
        let files = this.getIntroFilesFromInstance(module, glossary);

        // Get entries files.
        entries.forEach((entry) => {
            files = files.concat(entry.attachments || []);

            if (entry.definitioninlinefiles && entry.definitioninlinefiles.length) {
                files = files.concat(entry.definitioninlinefiles);
            }
        });

        return files;
    }

    /**
     * @inheritdoc
     */
    invalidateContent(moduleId: number, courseId: number): Promise<void> {
        return AddonModThGlossary.invalidateContent(moduleId, courseId);
    }

    /**
     * @inheritdoc
     */
    prefetch(module: CoreCourseAnyModuleData, courseId: number): Promise<void> {
        return this.prefetchPackage(module, courseId, (siteId) => this.prefetchGlossary(module, courseId, siteId));
    }

    /**
     * Prefetch a glossary.
     *
     * @param module The module object returned by WS.
     * @param courseId Course ID the module belongs to.
     * @param siteId Site ID.
     * @returns Promise resolved when done.
     */
    protected async prefetchGlossary(module: CoreCourseAnyModuleData, courseId: number, siteId: string): Promise<void> {
        const options = {
            cmId: module.id,
            readingStrategy: CoreSitesReadingStrategy.ONLY_NETWORK,
            siteId,
        };

        // Prefetch the glossary data.
        const glossary = await AddonModThGlossary.getGlossary(courseId, module.id, { siteId });

        const promises: Promise<unknown>[] = [];

        glossary.browsemodes.forEach((mode) => {
            switch (mode) {
                case 'letter': // Always done. Look bellow.
                    break;
                case 'cat':
                    promises.push(AddonModThGlossary.fetchAllEntries(
                        (newOptions) => AddonModThGlossary.getEntriesByCategory(glossary.id, newOptions),
                        options,
                    ));
                    break;
                case 'date':
                    promises.push(AddonModThGlossary.fetchAllEntries(
                        (newOptions) => AddonModThGlossary.getEntriesByDate(glossary.id, 'CREATION', newOptions),
                        options,
                    ));
                    promises.push(AddonModThGlossary.fetchAllEntries(
                        (newOptions) => AddonModThGlossary.getEntriesByDate(glossary.id, 'UPDATE', newOptions),
                        options,
                    ));
                    break;
                case 'author':
                    promises.push(AddonModThGlossary.fetchAllEntries(
                        (newOptions) => AddonModThGlossary.getEntriesByAuthor(glossary.id, newOptions),
                        options,
                    ));
                    break;
                default:
            }
        });

        // Fetch all entries to get information from.
        promises.push(AddonModThGlossary.fetchAllEntries(
            (newOptions) => AddonModThGlossary.getEntriesByLetter(glossary.id, newOptions),
            options,
        ).then((entries) => {
            const promises: Promise<unknown>[] = [];
            const commentsEnabled = CoreComments.areCommentsEnabledInSite();

            entries.forEach((entry) => {
                // Don't fetch individual entries, it's too many WS calls.
                if (glossary.allowcomments && commentsEnabled) {
                    promises.push(CoreComments.getComments(
                        ContextLevel.MODULE,
                        glossary.coursemodule,
                        'mod_thglossary',
                        entry.id,
                        'glossary_entry',
                        0,
                        siteId,
                    ));
                }
            });

            const files = this.getFilesFromGlossaryAndEntries(module, glossary, entries);
            promises.push(CoreFilepool.addFilesToQueue(siteId, files, this.component, module.id));

            // Prefetch user avatars.
            promises.push(CoreUser.prefetchUserAvatars(entries, 'userpictureurl', siteId));

            return Promise.all(promises);
        }));

        // Get all categories.
        promises.push(AddonModThGlossary.getAllCategories(glossary.id, options));

        // Prefetch data for link handlers.
        promises.push(CoreCourse.getModuleBasicInfo(module.id, { siteId }));
        promises.push(CoreCourse.getModuleBasicInfoByInstance(glossary.id, ADDON_MOD_TH_GLOSSARY_MODNAME, { siteId }));

        // Get course data, needed to determine upload max size if it's configured to be course limit.
        promises.push(CorePromiseUtils.ignoreErrors(CoreCourses.getCourseByField('id', courseId, siteId)));

        await Promise.all(promises);
    }

    /**
     * @inheritdoc
     */
    async sync(module: CoreCourseAnyModuleData, courseId: number, siteId?: string): Promise<AddonModThGlossarySyncResult> {
        const results = await Promise.all([
            AddonModThGlossarySync.syncGlossaryEntries(module.instance, undefined, siteId),
            AddonModThGlossarySync.syncRatings(module.id, undefined, siteId),
        ]);

        return {
            updated: results[0].updated || results[1].updated,
            warnings: results[0].warnings.concat(results[1].warnings),
        };
    }

}

export const AddonModThGlossaryPrefetchHandler = makeSingleton(AddonModThGlossaryPrefetchHandlerService);
