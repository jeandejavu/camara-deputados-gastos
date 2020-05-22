import createDeputados from '../services/deputados';

class MainController {
  async hello(req, res) {
    // const deputados = await api.get('deputados');
    // deputados.data.dados.forEach((d) => {});

    const deputados = createDeputados();
    deputados.run();

    return res.status(200).json({ msg: 'Servidor ok !' });
  }
}

export default new MainController();
