// CÓDIGO MÍNIMO DE TESTE
console.log('🔧 Script iniciado');

// Função de teste básica
function testeBasico() {
    console.log('✅ testeBasico() executada!');
    alert('JavaScript está funcionando!');
    
    // Tenta criar um elemento simples
    const div = document.createElement('div');
    div.innerHTML = '<p style="color: red; font-size: 20px;">✅ ELEMENTO CRIADO VIA JAVASCRIPT</p>';
    div.style.padding = '20px';
    div.style.border = '2px solid red';
    
    // Adiciona no corpo da página
    document.body.appendChild(div);
}

// Chama a função automaticamente após 1 segundo
setTimeout(testeBasico, 1000);