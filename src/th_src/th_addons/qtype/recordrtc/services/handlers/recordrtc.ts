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

import { Injectable, Type } from '@angular/core';

import { CoreQuestionHandler } from '@features/question/services/question-delegate';
import { makeSingleton } from '@singletons';
import { AddonQtypeRecordRTCComponent } from '../../component/recordrtc';
import { CoreQuestion, CoreQuestionQuestionParsed, CoreQuestionsAnswers } from '@features/question/services/question';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreFileSession } from '@services/file-session';
import { CoreFileUploader, CoreFileUploaderStoreFilesResult } from '@features/fileuploader/services/fileuploader';
import { CoreTextUtils } from '@services/utils/text';
import { CoreQuestionHelper } from '@features/question/services/question-helper';
import { CoreWSFile } from '@services/ws';

/**
 * Handler to support description question type.
 */
@Injectable({ providedIn: 'root' })
export class AddonQtypeRecordRTCHandlerService implements CoreQuestionHandler {
    name = 'AddonQtypeRecordRTC';
    type = 'qtype_recordrtc';


    /**
     * @inheritdoc
     */
    getBehaviour(): string {
        return 'informationitem';
    }

    /**
     * @inheritdoc
     */
    getComponent(): Type<unknown> {
        return AddonQtypeRecordRTCComponent;
    }

    /**
     * @inheritdoc
     */
    async isEnabled(): Promise<boolean> {
        return true;
    }

    /**
     * @inheritdoc
     */
    validateSequenceCheck(): boolean {
        // Descriptions don't have any answer so we'll always treat them as valid.
        return true;
    }

}

export const AddonQtypeRecordRTCHandler = makeSingleton(AddonQtypeRecordRTCHandlerService);
