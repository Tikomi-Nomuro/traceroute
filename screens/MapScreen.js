import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

const TelaMapa = () => {
  const [localizacao, setLocalizacao] = useState(null);
  const [termoBusca, setTermoBusca] = useState('');
  const [mensagemErro, setMensagemErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [pontosRota, setPontosRota] = useState([]);
  const [coordenadasRota, setCoordenadasRota] = useState([]);
  const [distancia, setDistancia] = useState(null);
  const [duracao, setDuracao] = useState(null);

  const mapaRef = useRef(null);

  useEffect(() => {
    obterLocalizacao();
  }, []);

  useEffect(() => {
    if (coordenadasRota.length > 0) {
      ajustarMapaParaRota(coordenadasRota);
    }
  }, [coordenadasRota]);

  const obterLocalizacao = async () => {
    setCarregando(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMensagemErro('Permissão de localização negada');
        setCarregando(false);
        return;
      }

      // localização 
      let localizacaoAtual = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.High 
      });
      
      // atualizar estado com nova localização
      const novaLocalizacao = {
        latitude: localizacaoAtual.coords.latitude,
        longitude: localizacaoAtual.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      setLocalizacao(novaLocalizacao);
      setMensagemErro(null);
      
      // centralizar mapa nova localização
      if (mapaRef.current) {
        mapaRef.current.animateToRegion(novaLocalizacao, 1000);
      }
      
    } catch (erro) {
      console.error('Erro ao obter localização:', erro);
      setMensagemErro('Erro ao obter localização. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  // buscar local por endereço
  const buscarLocal = async () => {
    if (!termoBusca.trim()) {
      setMensagemErro('Digite um endereço para buscar');
      return;
    }
    
    setCarregando(true);
    setMensagemErro(null);
  
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(termoBusca)}`;
      
      const resposta = await fetch(url, {
        headers: {
          'User-Agent': 'MeuAppMapa/1.0 (contato@meuemail.com)',
          'Accept-Language': 'pt-BR'
        }
      });
  
      if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);
  
      const dados = await resposta.json();
  
      if (dados.length === 0) {
        setMensagemErro('Nenhum local encontrado. Tente outro endereço.');
        return;
      }
  
      // Pegar o primeiro resultado
      const lugar = dados[0];
      const novaLocalizacao = {
        latitude: parseFloat(lugar.lat),
        longitude: parseFloat(lugar.lon),
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      setLocalizacao(novaLocalizacao);
      
      // centralizar mapa no local encontrado
      if (mapaRef.current) {
        mapaRef.current.animateToRegion(novaLocalizacao, 1000);
      }
      
    } catch (erro) {
      console.error('Erro na busca:', erro);
      setMensagemErro('Erro ao buscar local. Verifique sua conexão.');
    } finally {
      setCarregando(false);
    }
  };
  
  // toques mpaa
  const manipularToqueMapa = (evento) => {
    if (pontosRota.length >= 2) return; // Limitar a 2 pontos
    
    const novoPonto = {
      ...evento.nativeEvent.coordinate,
      id: Date.now().toString() // ID único para cada ponto
    };
    
    const novosPontos = [...pontosRota, novoPonto];
    setPontosRota(novosPontos);
    
    // se temos 2 pontos, calcula a rota
    if (novosPontos.length === 2) {
      calcularRota(novosPontos[0], novosPontos[1]);
    }
  };

  // calcular rota usando API OSRM
  const calcularRota = async (origem, destino) => {
    setCarregando(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origem.longitude},${origem.latitude};${destino.longitude},${destino.latitude}?overview=full&geometries=geojson`;
      
      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);
      
      const dados = await resposta.json();
      
      if (dados.routes.length === 0) {
        throw new Error('Nenhuma rota encontrada');
      }
      
      // pegar coordenadas da rota
      const coordenadas = dados.routes[0].geometry.coordinates.map(coord => ({
        latitude: coord[1],
        longitude: coord[0]
      }));
      
      setCoordenadasRota(coordenadas);
      setDistancia((dados.routes[0].distance / 1000).toFixed(2)); // km
      setDuracao((dados.routes[0].duration / 60).toFixed(1)); // minutos
      
    } catch (erro) {
      console.error('Erro ao calcular rota:', erro);
      Alert.alert('Erro', 'Não foi possível calcular a rota. Verifique os pontos selecionados.');
    } finally {
      setCarregando(false);
    }
  };

  //  ajusta o mapa par mostra toda a rota
  const ajustarMapaParaRota = (coordenadas) => {
    if (coordenadas.length === 0 || !mapaRef.current) return;
    
    // calcula limites da rota
    let minLat = coordenadas[0].latitude;
    let maxLat = coordenadas[0].latitude;
    let minLon = coordenadas[0].longitude;
    let maxLon = coordenadas[0].longitude;
    
    coordenadas.forEach(coord => {
      minLat = Math.min(minLat, coord.latitude);
      maxLat = Math.max(maxLat, coord.latitude);
      minLon = Math.min(minLon, coord.longitude);
      maxLon = Math.max(maxLon, coord.longitude);
    });
    
    mapaRef.current.fitToCoordinates(coordenadas, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true
    });
  };

  const limparRota = () => {
    setPontosRota([]);
    setCoordenadasRota([]);
    setDistancia(null);
    setDuracao(null);
  };

  const usarLocalizacaoAtualComoPartida = () => {
    if (!localizacao || pontosRota.length >= 2) return;
    
    const novoPonto = {
      latitude: localizacao.latitude,
      longitude: localizacao.longitude,
      id: 'local-atual'
    };
    
    const novosPontos = [...pontosRota, novoPonto];
    setPontosRota(novosPontos);
    
    // Se já tiver um ponto, calcular rota
    if (novosPontos.length === 2) {
      calcularRota(novosPontos[0], novosPontos[1]);
    }
  };

  return (
    <View style={estilos.container}>
      <View style={estilos.containerBusca}>
        <TextInput
          style={estilos.entrada}
          placeholder="Digite um endereço..."
          value={termoBusca}
          onChangeText={setTermoBusca}
          placeholderTextColor="#888"
        />
        <TouchableOpacity 
          style={[estilos.botao, estilos.botaoBusca]} 
          onPress={buscarLocal}
          disabled={carregando}
        >
          <Text style={estilos.textoBotao}>Buscar</Text>
        </TouchableOpacity>
      </View>

      <View style={estilos.containerBotoes}>
        <TouchableOpacity 
          style={[estilos.botao, estilos.botaoAtualizar]} 
          onPress={obterLocalizacao}
          disabled={carregando}
        >
          <Text style={estilos.textoBotao}>Minha Localização</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[estilos.botao, estilos.botaoUsarLocalizacao]} 
          onPress={usarLocalizacaoAtualComoPartida}
          disabled={!localizacao || carregando || pontosRota.length >= 2}
        >
          <Text style={estilos.textoBotao}>Usar como Partida</Text>
        </TouchableOpacity>
      </View>

      {carregando && !localizacao ? (
        <View style={estilos.containerCarregando}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={estilos.textoCarregando}>Obtendo localização...</Text>
        </View>
      ) : (
        <MapView 
          ref={mapaRef}
          style={estilos.mapa} 
          region={localizacao}
          onPress={manipularToqueMapa}
          showsUserLocation={true}
          showsMyLocationButton={false}
        >
          {localizacao && (
            <Marker 
              coordinate={localizacao} 
              title="Você está aqui" 
              pinColor="#3498db"
            />
          )}
          
          {pontosRota.map((ponto, indice) => (
            <Marker
              key={ponto.id}
              coordinate={ponto}
              title={indice === 0 ? "Partida" : "Destino"}
              pinColor={indice === 0 ? "#2ecc71" : "#e74c3c"}
            />
          ))}
          
          {coordenadasRota.length > 0 && (
            <Polyline 
              coordinates={coordenadasRota} 
              strokeWidth={4} 
              strokeColor="#3498db"
            />
          )}
        </MapView>
      )}

      {(distancia || duracao) && (
        <View style={estilos.containerInfoRota}>
          <Text style={estilos.textoInfoRota}>
            Distância: {distancia} km
          </Text>
          <Text style={estilos.textoInfoRota}>
            Duração: {duracao} min
          </Text>
        </View>
      )}

      {pontosRota.length > 0 && (
        <TouchableOpacity 
          style={[estilos.botao, estilos.botaoLimpar]} 
          onPress={limparRota}
          disabled={carregando}
        >
          <Text style={estilos.textoBotao}>Limpar Rota</Text>
        </TouchableOpacity>
      )}

      {mensagemErro && (
        <Text style={estilos.textoErro}>{mensagemErro}</Text>
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  containerBusca: {
    flexDirection: 'row',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  entrada: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    fontSize: 16,
    color: '#333',
  },
  containerBotoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  botao: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoBusca: {
    backgroundColor: '#3498db',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    minWidth: 80,
  },
  botaoAtualizar: {
    backgroundColor: '#2358C2',
    flex: 1,
  },
  botaoUsarLocalizacao: {
    backgroundColor: '#2358C2',
    flex: 1,
  },
  botaoLimpar: {
    backgroundColor: '#1A0DAB',
    marginTop: 12,
  },
  textoBotao: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapa: {
    flex: 1,
    borderRadius: 20,
    marginBottom: 20,
  },
  containerCarregando: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoCarregando: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
  },
  containerInfoRota: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  textoInfoRota: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 4,
  },
  textoErro: {
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 16,
  },
});

export default TelaMapa;