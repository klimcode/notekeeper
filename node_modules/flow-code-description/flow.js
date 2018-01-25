const red = '\x1b[31m%s\x1b[0m';
const green = '\x1b[32m%s\x1b[0m';

module.exports = function Flow(isLogging) {
    this.currentStep = null;
    this.to = (stepName, dataForStep) => {
        let stepHandler = this.steps[stepName];


        if (stepHandler) {
            this.currentStep = stepName;
            if (isLogging) console.log(green, `-->  ${stepName} \n`);

            if (typeof stepHandler == 'function') {

                stepHandler(dataForStep);
            } else if (typeof stepHandler == 'object' && stepHandler.length) {

                stepHandler.forEach((func) => func(dataForStep));
            } else {

                console.error(red, `FLOW TYPE ERROR: Handler must be a function or an Array. Error in step "${stepName}"`);
                return false;
            }
        } else {
            console.error(red, `FLOW ERROR: undefined handler for step "${stepName}"`);
        }
    }
}

