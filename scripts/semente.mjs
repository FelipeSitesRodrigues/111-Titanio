// Catálogo inicial: as 10 categorias do protótipo e os 12 produtos do Alex (preços de EXEMPLO).
// Roda de novo sem duplicar (upsert pelo slug). npm run semente
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { salvarCategoria, salvarProduto } from './_catalogo.mjs';

const IMG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '0111 - Titânio Ecommerce', 'prototipos', 'home', 'img'); // imagens ficam na pasta da documentação

const CATEGORIAS = [
  ['Celulares', 'celulares'], ['Informática', 'informatica'], ['TV e Vídeo', 'tv-e-video'],
  ['Eletroportáteis', 'eletroportateis'], ['Casa', 'casa'], ['Ferramentas', 'ferramentas'],
  ['Bebê', 'bebe'], ['Bem-estar', 'saude'], ['Limpeza', 'limpeza'],
];

const PRODUTOS = [
  { img: '1lBVxLY', cat: 'informatica', nome: 'Tablet 10" Android 16, 20GB + 128GB, com Teclado, Mouse e Caneta', preco: 899, de: 1099, selos: ['mais_vendido', 'destaque'] },
  { img: '1lBVxNg', cat: 'informatica', nome: 'Notebook Ultrafino 14" Intel, Windows 11, para Estudo e Trabalho', preco: 1499, selos: ['mais_vendido'] },
  { img: '1lBVyDw', cat: 'informatica', nome: 'Monitor Portátil Duplo 15,6" Full HD Dobrável', preco: 1899, de: 2199, selos: ['mais_vendido'] },
  { img: '1lBVxry', cat: 'tv-e-video', nome: 'Smart TV Portátil 21,5" Touch com Pedestal e Rodinhas', preco: 2799, selos: ['mais_vendido', 'destaque'] },
  { img: '1lBVyEf', cat: 'ferramentas', nome: 'Kit Ferramentas Sem Fio 20V 4 em 1 com Maleta', preco: 799, de: 999, selos: ['mais_vendido'] },
  { img: '1lBVxoN', cat: 'informatica', nome: 'Tablet 10" 20GB + 128GB, 6000mAh, Kit com Capa, Teclado e Caneta', preco: 849, selos: ['mais_vendido'] },
  { img: '1lBVxok', cat: 'informatica', nome: 'Tablet 10,1" Android 16, 12GB + 64GB, Bateria de 6000mAh', preco: 549, de: 699, selos: ['oferta'] },
  { img: '1lBW4rQ', cat: 'limpeza', nome: 'Escova Elétrica Giratória Sem Fio com 9 Cabeças', preco: 129, de: 179, selos: ['oferta'] },
  { img: '1lBVyGy', cat: 'bebe', nome: 'Roupão Infantil Poncho com Capuz de Bichinho', preco: 69, de: 89, selos: ['oferta'] },
  { img: '1lBVxgh', cat: 'casa', nome: 'Papel de Parede 3D Moderno, Rolo de 10 m', preco: 89, de: 119, selos: ['oferta'] },
  { img: '1lBW5N6', cat: 'bebe', nome: 'Fraldas Infantis Supersecas, Pacote Econômico', preco: 59, de: 74, selos: ['oferta'] },
  { img: '1lBVy6N', cat: 'saude', nome: 'Cama Inflável de Recuperação Pós-Cirúrgica com Bomba', preco: 449, de: 549, selos: ['oferta'] },
];

for (const [i, [nome, slug]] of CATEGORIAS.entries()) {
  await salvarCategoria({ slug, nome, imagem: path.join(IMG, `cat-${slug}.webp`), ordem: i });
  console.log('✓ categoria', slug);
}
for (const [i, p] of PRODUTOS.entries()) {
  const r = await salvarProduto({
    nome: p.nome, categoria: p.cat, preco: p.preco, preco_de: p.de, selos: p.selos, ordem: i,
    descricao: 'Produto importado direto da fonte pela Titânio Importes.',
    fotos: [path.join(IMG, `${p.img}.webp`)], estoque: 10,
  });
  console.log('✓ produto', r.slug);
}
