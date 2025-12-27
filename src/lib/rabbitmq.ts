import amqp from "amqplib";
let channel;
const initRabbitMQ = async (url: string) => {
    const connection = await amqp.connect(url);
    channel = await connection.createChannel();
};

const publishToQueue = async(exchange, routingKey, payload, options ={})=>{
    if(!channel){
        throw new Error("Publisher Not Initialize")
    }
    await channel.assertExchange(exchange, "topic")
}