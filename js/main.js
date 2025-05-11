document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('form-modal');
    const createBookBtn = document.getElementById('create-book-btn');
    const createBookBtnHeader = document.getElementById('create-book-btn-header');
    const closeModal = document.querySelector('.close-modal');
    const bookForm = document.getElementById('book-form');
    const nextButtons = document.querySelectorAll('.next-btn');
    const backButtons = document.querySelectorAll('.back-btn');
    const recipientOptions = document.querySelectorAll('.recipient-option');
    const progressTitle = document.getElementById('progress-title');
    let currentStep = 0;
    let selectedRecipient = '';

    const formSteps = Array.from(document.querySelectorAll('.form-step'));

    createBookBtn?.addEventListener('click', openModal);
    createBookBtnHeader?.addEventListener('click', openModal);
    closeModal?.addEventListener('click', closeModalFunc);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModalFunc();
    });

    function openModal() {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function closeModalFunc() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    function updateStep(newIndex) {
        formSteps[currentStep].classList.remove('active');
        currentStep = newIndex;
        formSteps[currentStep].classList.add('active');
        updateProgress();
        modal.querySelector('.modal-content').scrollTop = 0;
    }

    function updateProgress() {
        const step = formSteps[currentStep];
        if (step.dataset && step.dataset.recipient && step.dataset.step) {
            const questionIndex = step.dataset.step;
            const total = formSteps.filter(s => s.dataset.recipient === selectedRecipient).length;
            progressTitle.innerHTML = `Pregunta ${questionIndex} de ${total}`;

        } else {
            progressTitle.innerHTML = 'Crea tu libro personalizado';
        }
    }

    recipientOptions.forEach(option => {
        option.addEventListener('click', () => {
            recipientOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedRecipient = option.dataset.recipient;
            document.getElementById('tipo-input').value = selectedRecipient;
            document.getElementById('summary-recipient').textContent = getRecipientLabel(selectedRecipient);

            const firstStep = formSteps.findIndex(step =>
                step.dataset.recipient === selectedRecipient && step.dataset.step === '1'
            );
            updateStep(firstStep);
        });
    });

    function getRecipientLabel(recipient) {
        return {
            partner: 'Tu pareja',
            child: 'Tu hijo/a',
            parent: 'Tu padre/madre',
            sibling: 'Tu hermano/a'
        }[recipient] || '';
    }

    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            const currentElement = formSteps[currentStep];
            const isRecipientFinal =
                currentElement.dataset.recipient === selectedRecipient &&
                currentElement.dataset.step === '8';

            if (isRecipientFinal) {
                const summaryIndex = formSteps.findIndex(step => step.id === 'form-summary');
                updateStep(summaryIndex);
            } else {
                updateStep(currentStep + 1);
            }
        });
    });

    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            const currentElement = formSteps[currentStep];
            const isFirstOfBlock =
                currentElement.dataset.recipient === selectedRecipient &&
                currentElement.dataset.step === '1';

            if (isFirstOfBlock) {
                const selectionIndex = formSteps.findIndex(step => step.id === 'recipient-selection');
                updateStep(selectionIndex);
            } else {
                updateStep(currentStep - 1);
            }
        });
    });

bookForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const formData = new FormData(bookForm);
    const jsonData = {};

    formData.forEach((value, key) => {
        jsonData[key] = value;
    });

    // Envío al webhook de Make
    fetch('https://hook.eu2.make.com/bamawr2rpu3liznhi5l7g8u4849hfob5', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(jsonData)
    })
    .then(response => {
        if (!response.ok) throw new Error('Error al enviar');
        
        // Avanzar al paso de "Procesando" si todo fue bien
        updateStep(formSteps.findIndex(s => s.id === 'processing'));

        // Simula la generación y pasa a la previsualización
        setTimeout(() => {
            updateStep(formSteps.findIndex(s => s.id === 'preview'));
        }, 3000);
    })
    .catch(error => {
        console.error('Error al enviar el formulario:', error);
        document.getElementById('submission-error').style.display = 'block';
    });
});


    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            faqItems.forEach(faq => faq.classList.remove('active'));
            item.classList.toggle('active');
        });
    });

    const observer = new IntersectionObserver(handleIntersection, { threshold: 0.1 });
    function handleIntersection(entries, obs) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = 1;
                obs.unobserve(entry.target);
            }
        });
    }

    document.querySelectorAll('.step, .example, .testimonial, .price-card').forEach(el => observer.observe(el));
});