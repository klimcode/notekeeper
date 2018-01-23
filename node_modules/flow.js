module.exports = function Flow() {
    this.currentStep = null;
    this.to = (stepName, dataForNextStep) => {
        let stepHandler = this.steps[stepName];


        if (stepHandler) {
            this.currentStep = stepName;
            console.log(`-->  ${stepName} \n`);

            if (typeof stepHandler == 'function') {

                stepHandler(dataForNextStep);
            } else if (typeof stepHandler == 'object' && stepHandler.length) {

                stepHandler.forEach((func) => func(dataForNextStep));
            } else {

                console.error(`FLOW TYPE ERROR: Handler must be a function or an Array. Error in step: "${stepName}"`);
                return false;
            }
        } else {
            console.error(`FLOW ERROR: undefined handler for step "${stepName}"`);
        }
    }
}
