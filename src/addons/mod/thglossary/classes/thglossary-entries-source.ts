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

import { Params } from '@angular/router';
import { CoreRoutedItemsManagerSource } from '@classes/items-management/routed-items-manager-source';
import {
    AddonModThGlossary,
    AddonModThGlossaryEntry,
    AddonModThGlossaryGetEntriesOptions,
    AddonModThGlossaryGetEntriesWSResponse,
    AddonModThGlossaryGlossary,
} from '../services/thglossary';
import { AddonModThGlossaryOffline, AddonModThGlossaryOfflineEntry } from '../services/thglossary-offline';
import { ADDON_MOD_TH_GLOSSARY_LIMIT_ENTRIES } from '../constants';

/**
 * Provides a collection of glossary entries.
 */
export class AddonModThGlossaryEntriesSource extends CoreRoutedItemsManagerSource<AddonModThGlossaryEntryItem> {

    readonly COURSE_ID: number;
    readonly CM_ID: number;
    readonly GLOSSARY_PATH_PREFIX: string;

    isSearch = false;
    hasSearched = false;
    fetchMode?: AddonModThGlossaryFetchMode;
    viewMode?: string;
    glossary?: AddonModThGlossaryGlossary;
    onlineEntries: AddonModThGlossaryEntry[] = [];
    offlineEntries: AddonModThGlossaryOfflineEntry[] = [];

    protected fetchFunction?: (options?: AddonModThGlossaryGetEntriesOptions) => Promise<AddonModThGlossaryGetEntriesWSResponse>;
    protected fetchInvalidate?: () => Promise<void>;

    constructor(courseId: number, cmId: number, glossaryPathPrefix: string) {
        super();

        this.COURSE_ID = courseId;
        this.CM_ID = cmId;
        this.GLOSSARY_PATH_PREFIX = glossaryPathPrefix;
    }

    /**
     * Type guard to infer entry objects.
     *
     * @param entry Item to check.
     * @returns Whether the item is an offline entry.
     */
    isOnlineEntry(entry: AddonModThGlossaryEntryItem): entry is AddonModThGlossaryEntry {
        return 'id' in entry;
    }

    /**
     * Type guard to infer entry objects.
     *
     * @param entry Item to check.
     * @returns Whether the item is an offline entry.
     */
    isOfflineEntry(entry: AddonModThGlossaryEntryItem): entry is AddonModThGlossaryOfflineEntry {
        return !this.isOnlineEntry(entry);
    }

    /**
     * @inheritdoc
     */
    getItemPath(entry: AddonModThGlossaryEntryItem): string {
        if (this.isOfflineEntry(entry)) {
            return `${this.GLOSSARY_PATH_PREFIX}entry/new-${entry.timecreated}`;
        }

        return `${this.GLOSSARY_PATH_PREFIX}entry/${entry.id}`;
    }

    /**
     * @inheritdoc
     */
    getItemQueryParams(): Params {
        return {
            cmId: this.CM_ID,
            courseId: this.COURSE_ID,
        };
    }

    /**
     * @inheritdoc
     */
    getPagesLoaded(): number {
        if (this.items === null) {
            return 0;
        }

        return Math.ceil(this.onlineEntries.length / this.getPageLength());
    }

    /**
     * Start searching.
     */
    startSearch(): void {
        this.isSearch = true;
        this.setDirty(true);
    }

    /**
     * Stop searching and restore unfiltered collection.
     *
     * @param cachedOnlineEntries Cached online entries.
     * @param hasMoreOnlineEntries Whether there were more online entries.
     */
    stopSearch(cachedOnlineEntries: AddonModThGlossaryEntry[], hasMoreOnlineEntries: boolean): void {
        if (!this.fetchMode) {
            return;
        }

        this.isSearch = false;
        this.hasSearched = false;
        this.onlineEntries = cachedOnlineEntries;
        this.hasMoreItems = hasMoreOnlineEntries;
        this.setDirty(true);
    }

    /**
     * Set search query.
     *
     * @param query Search query.
     */
    search(query: string): void {
        if (!this.glossary) {
            return;
        }

        const thglossaryid = this.glossary.id;

        this.fetchFunction = (options) => AddonModThGlossary.getEntriesBySearch(thglossaryid, query, true, options);
        this.fetchInvalidate = () => AddonModThGlossary.invalidateEntriesBySearch(thglossaryid, query, true);
        this.hasSearched = true;
        this.setDirty(true);
    }

    /**
     * Load glossary.
     */
    async loadGlossary(): Promise<void> {
        this.glossary = await AddonModThGlossary.getGlossary(this.COURSE_ID, this.CM_ID);
    }

    /**
     * Invalidate glossary cache.
     *
     * @param invalidateGlossary Whether to invalidate the entire glossary or not
     */
    async invalidateCache(invalidateGlossary: boolean = true): Promise<void> {
        await Promise.all<unknown>([
            this.fetchInvalidate && this.fetchInvalidate(),
            invalidateGlossary && AddonModThGlossary.invalidateCourseGlossaries(this.COURSE_ID),
            invalidateGlossary && this.glossary && AddonModThGlossary.invalidateCategories(this.glossary.id),
        ]);
    }

    /**
     * Change fetch mode.
     *
     * @param mode New mode.
     */
    switchMode(mode: AddonModThGlossaryFetchMode): void {
        if (!this.glossary) {
            throw new Error('Can\'t switch entries mode without a glossary!');
        }

        const thglossaryid = this.glossary.id;
        this.fetchMode = mode;
        this.isSearch = false;
        this.setDirty(true);

        switch (mode) {
            case 'author_all':
                // Browse by author.
                this.viewMode = 'author';
                this.fetchFunction = (options) => AddonModThGlossary.getEntriesByAuthor(thglossaryid, options);
                this.fetchInvalidate = () => AddonModThGlossary.invalidateEntriesByAuthor(thglossaryid);
                break;

            case 'cat_all':
                // Browse by category.
                this.viewMode = 'cat';
                this.fetchFunction = (options) => AddonModThGlossary.getEntriesByCategory(thglossaryid, options);
                this.fetchInvalidate = () => AddonModThGlossary.invalidateEntriesByCategory(thglossaryid);
                break;

            case 'newest_first':
                // Newest first.
                this.viewMode = 'date';
                this.fetchFunction = (options) => AddonModThGlossary.getEntriesByDate(thglossaryid, 'CREATION', options);
                this.fetchInvalidate = () => AddonModThGlossary.invalidateEntriesByDate(thglossaryid, 'CREATION');
                break;

            case 'recently_updated':
                // Recently updated.
                this.viewMode = 'date';
                this.fetchFunction = (options) => AddonModThGlossary.getEntriesByDate(thglossaryid, 'UPDATE', options);
                this.fetchInvalidate = () => AddonModThGlossary.invalidateEntriesByDate(thglossaryid, 'UPDATE');
                break;

            case 'letter_all':
            default:
                // Consider it is 'letter_all'.
                this.viewMode = 'letter';
                this.fetchMode = 'letter_all';
                this.fetchFunction = (options) => AddonModThGlossary.getEntriesByLetter(thglossaryid, options);
                this.fetchInvalidate = () => AddonModThGlossary.invalidateEntriesByLetter(thglossaryid);
                break;
        }
    }

    /**
     * @inheritdoc
     */
    protected async loadPageItems(page: number): Promise<{ items: AddonModThGlossaryEntryItem[]; hasMoreItems: boolean }> {
        const glossary = this.glossary;
        const fetchFunction = this.fetchFunction;

        if (!glossary || !fetchFunction) {
            throw new Error('Can\'t load entries without glossary or fetch function');
        }

        const entries: AddonModThGlossaryEntryItem[] = [];

        if (page === 0) {
            const offlineEntries = await AddonModThGlossaryOffline.getGlossaryOfflineEntries(glossary.id);

            offlineEntries.sort((a, b) => a.concept.localeCompare(b.concept));

            entries.push(...offlineEntries);
        }

        const from = page * this.getPageLength();
        const pageEntries = await fetchFunction({ from, cmId: this.CM_ID });

        entries.push(...pageEntries.entries);

        return {
            items: entries,
            hasMoreItems: from + pageEntries.entries.length < pageEntries.count,
        };
    }

    /**
     * @inheritdoc
     */
    protected getPageLength(): number {
        return ADDON_MOD_TH_GLOSSARY_LIMIT_ENTRIES;
    }

    /**
     * @inheritdoc
     */
    protected setItems(entries: AddonModThGlossaryEntryItem[], hasMoreItems: boolean): void {
        this.onlineEntries = [];
        this.offlineEntries = [];

        entries.forEach(entry => {
            this.isOnlineEntry(entry) && this.onlineEntries.push(entry);
            this.isOfflineEntry(entry) && this.offlineEntries.push(entry);
        });

        super.setItems(entries, hasMoreItems);
    }

    /**
     * @inheritdoc
     */
    reset(): void {
        this.onlineEntries = [];
        this.offlineEntries = [];

        super.reset();
    }

}

/**
 * Type of items that can be held by the entries manager.
 */
export type AddonModThGlossaryEntryItem = AddonModThGlossaryEntry | AddonModThGlossaryOfflineEntry;

/**
 * Fetch mode to sort entries.
 */
export type AddonModThGlossaryFetchMode = 'author_all' | 'cat_all' | 'newest_first' | 'recently_updated' | 'letter_all';
