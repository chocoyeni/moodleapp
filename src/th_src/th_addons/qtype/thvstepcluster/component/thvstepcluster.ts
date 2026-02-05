import { Component, ElementRef } from '@angular/core';
import { FormBuilder, FormControl } from '@angular/forms';
import { CoreFileUploaderStoreFilesResult } from '@features/fileuploader/services/fileuploader';
import { AddonModQuizEssayQuestion, AddonModQuizMultichoiceQuestion, AddonModQuizQuestion, AddonModQuizQuestionRadioOption, AddonModQuizTextQuestion, CoreQuestionBaseComponent } from '@features/question/classes/base-question-component';
import { CoreQuestionsAnswers } from '@features/question/services/question';
import { CoreQuestionComponent } from "@features/question/components/question/question";


@Component({
    selector: 'addon-qtype-thvstepcluster',
    templateUrl: 'addon-qtype-Thvstepcluster.html',
    imports: [CoreQuestionComponent],
})
export class AddonQtypeThvstepclusterComponent extends CoreQuestionBaseComponent<any> {

    constructor(elementRef: ElementRef, protected fb: FormBuilder) {
        super();
    }


    childQuestions: AddonModQuizQuestion[] = [];


    init(): void {
        this.initVstepClusterComponent();
    }


    initVstepClusterComponent(): void | HTMLElement {
        const questionEl = this.initComponent();

        if (!questionEl || !this.question) {
            return;
        }

        let childQuestionsElement = Array.from(questionEl.querySelectorAll<HTMLElement>('.que:not(.thvstepcluster)'));

        const input = <HTMLInputElement>questionEl.querySelector('input[name*=sequencecheck]')

        console.log(childQuestionsElement);

        childQuestionsElement.forEach(child_question => {


            child_question.appendChild(input);

            const question: AddonModQuizQuestion = {
                flagged: this.question.flagged,
                html: child_question.outerHTML,
                page: this.question.page,
                slot: this.question.slot,
                type: '',
                sequencecheck: this.question.sequencecheck
            }

            if (child_question.classList.contains('essay')) {
                const cq: AddonModQuizQuestion = { ...question, type: "essay" };
                this.childQuestions.push(cq);
            } else if (child_question.classList.contains('multichoice')) {
                const cq: AddonModQuizQuestion = { ...question, type: "multichoice" };
                this.childQuestions.push(cq);

            } else if (child_question.classList.contains('description')) {
                const cq: AddonModQuizQuestion = { ...question, type: "description" };
                this.childQuestions.push(cq);
            }
            else if (child_question.classList.contains('truefalse')) {
                const cq: AddonModQuizQuestion = { ...question, type: "truefalse" };
                this.childQuestions.push(cq);
            }
            else if (child_question.classList.contains('shortanswer')) {
                const cq: AddonModQuizQuestion = { ...question, type: "shortanswer" };
                this.childQuestions.push(cq);
            }
            else if (child_question.classList.contains('multianswer')) {
                question.html = `<div class="formulation clearfix">${question.html}</div>`;
                const cq: any = {...question,type: 'multianswer',text:  question.html,};
                this.childQuestions.push(cq);
            }
        });

        console.log(this.childQuestions);
        this.question.childQuestions = this.childQuestions;

        return questionEl;
    }



}
