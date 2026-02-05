import { Injectable, Type } from '@angular/core';
import { CoreQuestionHandler } from '@features/question/services/question-delegate';
import { makeSingleton, Translate } from '@singletons';
import { AddonQtypeThvstepclusterComponent } from '../../component/thvstepcluster';
import { FileEntry } from '@awesome-cordova-plugins/file/ngx';

import { CoreFileUploader, CoreFileUploaderStoreFilesResult } from '@features/fileuploader/services/fileuploader';
import { AddonModQuizEssayQuestion, AddonModQuizMultichoiceQuestion, AddonModQuizQuestion } from '@features/question/classes/base-question-component';
import { CoreQuestion, CoreQuestionQuestionParsed, CoreQuestionsAnswers } from '@features/question/services/question';

import { CoreQuestionHelper } from '@features/question/services/question-helper';
import { CoreFileSession } from '@services/file-session';
import { CoreSites } from '@services/sites';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreTextUtils } from '@services/utils/text';
import { CoreUtils } from '@services/utils/utils';
import { CoreWSFile } from '@services/ws';





@Injectable({ providedIn: 'root' })
export class AddonQtypeThvstepclusterHandlerService implements CoreQuestionHandler {
    name = 'AddonQtypeThvstepcluster';
    type = 'qtype_thvstepcluster';
    getComponent(): Type<unknown> {
        return AddonQtypeThvstepclusterComponent;
    }
    async isEnabled(): Promise<boolean> {
        return true;
    }

    clearTmpData(question: CoreQuestionQuestionParsed, component: string, componentId: string | number): void {
        const questionComponentId = CoreQuestion.getQuestionComponentId(question, componentId);
        const files = CoreFileSession.getFiles(component, questionComponentId);

        // Clear the files in session for this question.
        CoreFileSession.clearFiles(component, questionComponentId);

        // Now delete the local files from the tmp folder.
        CoreFileUploader.clearTmpFiles(files);
    }
    deleteOfflineData(
        question: CoreQuestionQuestionParsed,
        component: string,
        componentId: string | number,
        siteId?: string,
    ): Promise<void> {
        return CoreQuestionHelper.deleteStoredQuestionFiles(question, component, componentId, siteId);
    }
    getAdditionalDownloadableFiles(question: CoreQuestionQuestionParsed): CoreWSFile[] {
        if (!question.responsefileareas) {
            return [];
        }

        return question.responsefileareas.reduce((urlsList, area) => urlsList.concat(area.files || []), <CoreWSFile[]>[]);
    }
    protected getAllowedOptions(question: CoreQuestionQuestionParsed): { text: boolean; attachments: boolean } {
        if (question.parsedSettings) {
            return {
                text: question.parsedSettings.responseformat != 'noinline',
                attachments: question.parsedSettings.attachments != '0',
            };
        }

        const element = CoreDomUtils.convertToElement(question.html);

        return {
            text: !!element.querySelector('textarea[name*=_answer]'),
            attachments: !!element.querySelector('div[id*=filemanager]'),
        };
    }
    getBehaviour(): string {
        return 'manualgraded';
    }
    getPreventSubmitMessage(question: CoreQuestionQuestionParsed): string | undefined {
        const element = CoreDomUtils.convertToElement(question.html);
        const uploadFilesSupported = question.responsefileareas !== undefined;

        if (!uploadFilesSupported && element.querySelector('div[id*=filemanager]')) {
            // The question allows attachments. Since the app cannot attach files yet we will prevent submitting the question.
            return 'core.question.errorattachmentsnotsupportedinsite';
        }

        if (!uploadFilesSupported && CoreQuestionHelper.hasDraftFileUrls(element.innerHTML)) {
            return 'core.question.errorembeddedfilesnotsupportedinsite';
        }
    }
    getValidationError(
        question: CoreQuestionQuestionParsed,
        answers: CoreQuestionsAnswers,
        onlineError: string | undefined,
    ): string | undefined {
        if (answers.answer === undefined) {
            // Not answered in offline.
            return onlineError;
        }

        if (!answers.answer) {
            // Not answered yet, no error.
            return;
        }

        return this.checkInputWordCount(question, <string>answers.answer, onlineError);
    }
    protected checkInputWordCount(
        question: CoreQuestionQuestionParsed,
        answer: string,
        onlineError: string | undefined,
    ): string | undefined {
        if (!question.parsedSettings || question.parsedSettings.maxwordlimit === undefined ||
            question.parsedSettings.minwordlimit === undefined) {
            // Min/max not supported, use online error.
            return onlineError;
        }

        const minWords = Number(question.parsedSettings.minwordlimit);
        const maxWords = Number(question.parsedSettings.maxwordlimit);

        if (!maxWords && !minWords) {
            // No min and max, no error.
            return;
        }

        // Count the number of words in the response string.
        const count = CoreTextUtils.countWords(answer);
        if (maxWords && count > maxWords) {
            return Translate.instant('addon.qtype_essay.maxwordlimitboundary', { $a: { limit: maxWords, count: count } });
        } else if (count < minWords) {
            return Translate.instant('addon.qtype_essay.minwordlimitboundary', { $a: { limit: minWords, count: count } });
        }
    }
    isCompleteResponse(
        question: CoreQuestionQuestionParsed,
        answers: CoreQuestionsAnswers,
        component: string,
        componentId: string | number,
    ): number {

        const hasTextAnswer = !!answers.answer;
        const uploadFilesSupported = question.responsefileareas !== undefined;
        const allowedOptions = this.getAllowedOptions(question);

        if (hasTextAnswer && this.checkInputWordCount(question, <string>answers.answer, undefined)) {
            return 0;
        }

        if (!allowedOptions.attachments) {
            return hasTextAnswer ? 1 : 0;
        }

        if (!uploadFilesSupported || !question.parsedSettings) {
            // We can't know if the attachments are required or if the user added any in web.
            return -1;
        }

        const questionComponentId = CoreQuestion.getQuestionComponentId(question, componentId);
        const attachments = CoreFileSession.getFiles(component, questionComponentId);

        if (!allowedOptions.text) {
            return attachments && attachments.length >= Number(question.parsedSettings.attachmentsrequired) ? 1 : 0;
        }

        return ((hasTextAnswer || question.parsedSettings.responserequired == '0') &&
            (attachments && attachments.length >= Number(question.parsedSettings.attachmentsrequired))) ? 1 : 0;
    }

    /**
     * @inheritdoc
     */
    isGradableResponse(
        question: CoreQuestionQuestionParsed,
        answers: CoreQuestionsAnswers,
        component: string,
        componentId: string | number,
    ): number {
        if (question.responsefileareas === undefined) {
            return -1;
        }

        const questionComponentId = CoreQuestion.getQuestionComponentId(question, componentId);
        const attachments = CoreFileSession.getFiles(component, questionComponentId);

        // Determine if the given response has online text or attachments.
        return (answers.answer && answers.answer !== '') || (attachments && attachments.length > 0) ? 1 : 0;
    }
    isSameResponse(
        question: CoreQuestionQuestionParsed,
        prevAnswers: CoreQuestionsAnswers,
        newAnswers: CoreQuestionsAnswers,
        component: string,
        componentId: string | number,
    ): boolean {
        const uploadFilesSupported = question.responsefileareas !== undefined;
        const allowedOptions = this.getAllowedOptions(question);

        // First check the inline text.
        const answerIsEqual = allowedOptions.text ?
            CoreUtils.sameAtKeyMissingIsBlank(prevAnswers, newAnswers, 'answer') : true;

        if (!allowedOptions.attachments || !uploadFilesSupported || !answerIsEqual) {
            // No need to check attachments.
            return answerIsEqual;
        }

        // Check attachments now.
        const questionComponentId = CoreQuestion.getQuestionComponentId(question, componentId);
        const attachments = CoreFileSession.getFiles(component, questionComponentId);
        const originalAttachments = CoreQuestionHelper.getResponseFileAreaFiles(question, 'attachments');

        return !CoreFileUploader.areFileListDifferent(attachments, originalAttachments);
    }



    async prepareAttachments(
        question: CoreQuestionQuestionParsed,
        answers: CoreQuestionsAnswers,
        offline: boolean,
        component: string,
        componentId: string | number,
        attachmentsInput: HTMLInputElement,
        siteId?: string,
    ): Promise<void> {

        // Treat attachments if any.
        const questionComponentId = CoreQuestion.getQuestionComponentId(question, componentId);
        const attachments = CoreFileSession.getFiles(component, questionComponentId);
        const draftId = Number(attachmentsInput.value);

        if (offline) {
            // Get the folder where to store the files.
            const folderPath = CoreQuestion.getQuestionFolder(question.type, component, questionComponentId, siteId);

            const result = await CoreFileUploader.storeFilesToUpload(folderPath, attachments);

            // Store the files in the answers.
            answers[attachmentsInput.name + '_offline'] = JSON.stringify(result);
        } else {
            // Check if any attachment was deleted.
            const originalAttachments = CoreQuestionHelper.getResponseFileAreaFiles(question, 'attachments');
            const filesToDelete = CoreFileUploader.getFilesToDelete(originalAttachments, attachments);

            if (filesToDelete.length > 0) {
                // Delete files.
                await CoreFileUploader.deleteDraftFiles(draftId, filesToDelete, siteId);
            }

            await CoreFileUploader.uploadFiles(draftId, attachments, siteId);
        }
    }
    async prepareSyncData(
        question: CoreQuestionQuestionParsed,
        answers: CoreQuestionsAnswers,
        component: string,
        componentId: string | number,
        siteId?: string,
    ): Promise<void> {

        const element = CoreDomUtils.convertToElement(question.html);
        const attachmentsInput = <HTMLInputElement>element.querySelector('.attachments input[name*=_attachments]');

        if (attachmentsInput) {
            // Update the draft ID, the stored one could no longer be valid.
            answers.attachments = attachmentsInput.value;
        }

        if (!answers || !answers.attachments_offline) {
            return;
        }

        const attachmentsData: CoreFileUploaderStoreFilesResult = CoreTextUtils.parseJSON(
            <string>answers.attachments_offline,
            {
                online: [],
                offline: 0,
            },
        );
        delete answers.attachments_offline;

        // Check if any attachment was deleted.
        const originalAttachments = CoreQuestionHelper.getResponseFileAreaFiles(question, 'attachments');
        const filesToDelete = CoreFileUploader.getFilesToDelete(originalAttachments, attachmentsData.online);

        if (filesToDelete.length > 0) {
            // Delete files.
            await CoreFileUploader.deleteDraftFiles(Number(answers.attachments), filesToDelete, siteId);
        }

        if (!attachmentsData.offline) {
            return;
        }

        // Upload the offline files.
        const offlineFiles =
            <FileEntry[]>await CoreQuestionHelper.getStoredQuestionFiles(question, component, componentId, siteId);

        await CoreFileUploader.uploadFiles(
            Number(answers.attachments),
            [...attachmentsData.online, ...offlineFiles],
            siteId,
        );
    }
    async prepareTextAnswer(
        question: AddonModQuizEssayQuestion,
        answers: CoreQuestionsAnswers,
        textarea: HTMLTextAreaElement,
        siteId?: string,
    ): Promise<void> {
        if (CoreQuestionHelper.hasDraftFileUrls(question.html) && question.responsefileareas) {
            // Restore draftfile URLs.
            const site = await CoreSites.getSite(siteId);

            answers[textarea.name] = CoreTextUtils.restoreDraftfileUrls(
                site.getURL(),
                <string>answers[textarea.name],
                question.html,
                CoreQuestionHelper.getResponseFileAreaFiles(question, 'answer'),
            );
        }

        let isPlainText = false;
        if (question.isPlainText !== undefined) {
            isPlainText = question.isPlainText;
        } else if (question.parsedSettings) {
            isPlainText = question.parsedSettings.responseformat == 'monospaced' ||
                question.parsedSettings.responseformat == 'plain';
        } else {
            const questionEl = CoreDomUtils.convertToElement(question.html);
            isPlainText = !!questionEl.querySelector('.qtype_essay_monospaced') || !!questionEl.querySelector('.qtype_essay_plain');
        }

        if (!isPlainText) {
            // Add some HTML to the text if needed.
            answers[textarea.name] = CoreTextUtils.formatHtmlLines(<string>answers[textarea.name] || '');
        }
    }


    /**
 * @inheritdoc
 */
    prepareAnswers(
        question: AddonModQuizQuestion,
        answers: CoreQuestionsAnswers,
    ): void {

        const childQuestions: CoreQuestionsAnswers[] = (<any>question).childQuestions;

        childQuestions.forEach(child_question => {
            if(child_question.type=='multichoice' && child_question.optionsName)
            {
                const optionName = <string>child_question.optionsName;
                if(answers[optionName]!== undefined && !answers[optionName])
                {
                    delete answers[optionName];
                }
            }
        });
    }
}
export const AddonQtypeThvstepclusterHandler = makeSingleton(AddonQtypeThvstepclusterHandlerService);
